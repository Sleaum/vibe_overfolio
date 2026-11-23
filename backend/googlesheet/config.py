"""
Paramètres d'accès au Google Sheet.

Ils sont saisis sur la page GoogleSheet et enregistrés en base (modèle SheetConfig).
Tant que rien n'a été enregistré, les valeurs du .env s'appliquent : ce sont aussi
les valeurs proposées par défaut dans le formulaire.

Trois façons de lire la feuille (access_mode) :
- « service_account » : un compte de service complet est renseigné -> API Google Sheets (feuille privée possible) ;
- « public_link » : pas de compte de service, seulement le lien -> export d'une feuille partagée par lien ;
- « google » : compte Google de la personne connectée (feuille choisie dans le sélecteur de Google, scope drive.file) ;
- « none » : rien de configuré.

Propriétaire (`owner`) : None = le site (visiteurs non connectés), sinon un utilisateur connecté.
Chaque propriétaire a sa propre configuration (une ligne SheetConfig) et ses propres tables.
Le .env ne sert que pour le site : un compte n'en hérite jamais (ni lien, ni compte de service, ni clé).
"""
import os
import re

from django.db import IntegrityError, transaction
from typing import Dict, List, Optional

from .models import SheetConfig

DEFAULT_TABS = ["portfolio", "inout", "stock", "budget", "history"]
DEFAULT_DOC_NAME = "overfolio"

# Champ du modèle -> variable du .env
ENV_VARS: Dict[str, str] = {
    "type": "TYPE",
    "project_id": "PROJECT_ID",
    "private_key_id": "PRIVATE_KEY_ID",
    "private_key": "PRIVATE_KEY",
    "client_email": "CLIENT_EMAIL",
    "client_id": "CLIENT_ID",
    "auth_uri": "AUTH_URI",
    "token_uri": "TOKEN_URI",
    "auth_provider_x509_cert_url": "AUTH_PROVIDER_X509_CERT_URL",
    "client_x509_cert_url": "CLIENT_X509_CERT_URL",
    "universe_domain": "UNIVERSE_DOMAIN",
    "sheet_id": "GOOGLE_SHEET_ID",
    "doc_name": "GOOGLE_SHEET_DOC_NAME",
    "sync_tabs": "SHEET_SYNC_TABS",
}

# Champs du compte de service, dans l'ordre du fichier JSON de Google
CREDENTIAL_FIELDS = [
    "type",
    "project_id",
    "private_key_id",
    "private_key",
    "client_email",
    "client_id",
    "auth_uri",
    "token_uri",
    "auth_provider_x509_cert_url",
    "client_x509_cert_url",
    "universe_domain",
]
REQUIRED_CREDENTIALS = ("type", "project_id", "private_key", "client_email")

# Le seul champ secret : il n'est jamais renvoyé au navigateur
SECRET_FIELDS = {"private_key"}
# Champs conservés quand l'enregistrement ne les contient pas : la clé privée (jamais renvoyée),
# et les onglets, réglés sur la page GoogleSheet à part du formulaire de connexion (save_tabs)
KEPT_WHEN_ABSENT = SECRET_FIELDS | {"sync_tabs"}

FIELDS = list(ENV_VARS)

_SHEET_URL_RE = re.compile(r"/spreadsheets/d/([a-zA-Z0-9_-]+)")


def _normalize_private_key(value: str) -> str:
    # Selon l'outil qui a chargé le .env (ou ce qui a été collé), les "\n" peuvent rester littéraux.
    return (value or "").replace("\\n", "\n").replace("\r\n", "\n")


def normalize_sheet_id(value: str) -> str:
    """Accepte l'identifiant seul ou l'URL complète du document."""
    value = (value or "").strip()
    match = _SHEET_URL_RE.search(value)
    return match.group(1) if match else value


def parse_tabs(raw: str) -> List[str]:
    return [name.strip() for name in (raw or "").split(",") if name.strip()]


def request_owner(request):
    """Propriétaire d'une requête : l'utilisateur connecté, sinon None (le site)."""
    user = getattr(request, "user", None)
    return user if user is not None and user.is_authenticated else None


class ScopeMismatch(Exception):
    """La page croit modifier la configuration du compte (ou du site), mais la session a changé entre-temps."""

    def __init__(self, message, code, status):
        super().__init__(message)
        self.code = code
        self.status = status


def owner_for_change(request):
    """
    Propriétaire d'une requête qui modifie (enregistrer, effacer, synchroniser).

    La page envoie l'en-tête X-Sheet-Scope (« account » ou « site ») : la configuration qu'elle affiche. Si la session
    a expiré (ou changé dans un autre onglet) depuis, la modification est refusée au lieu de partir sur une autre
    configuration — sinon la feuille privée d'un compte pourrait finir dans celle du site, lisible par tous.
    Sans en-tête (ligne de commande, curl), pas de contrôle.
    """
    owner = request_owner(request)
    expected = request.headers.get("X-Sheet-Scope", "").strip().lower()
    if expected == "account" and owner is None:
        raise ScopeMismatch("Ta session a expiré : recharge la page.", "session_expired", 401)
    if expected == "site" and owner is not None:
        raise ScopeMismatch("Tu t'es connecté entre-temps : recharge la page.", "scope_changed", 409)
    return owner


def default_values() -> Dict[str, str]:
    """Valeurs de départ d'un compte : rien de configuré (le .env du site ne s'applique pas aux comptes)."""
    values = {field: "" for field in FIELDS}
    values["type"] = "service_account"
    values["doc_name"] = DEFAULT_DOC_NAME
    values["sync_tabs"] = ",".join(DEFAULT_TABS)
    return values


def base_values(owner=None) -> Dict[str, str]:
    """Valeurs quand rien n'est enregistré : le .env pour le site, rien pour un compte."""
    return env_values() if owner is None else default_values()


def env_values() -> Dict[str, str]:
    """Valeurs du .env (et valeurs par défaut quand une variable est absente)."""
    values = {field: os.getenv(var, "") or "" for field, var in ENV_VARS.items()}
    values["private_key"] = _normalize_private_key(values["private_key"])
    values["type"] = values["type"] or "service_account"
    values["doc_name"] = values["doc_name"] or DEFAULT_DOC_NAME
    values["sync_tabs"] = values["sync_tabs"] or ",".join(DEFAULT_TABS)
    return values


def saved_config(owner=None) -> Optional[SheetConfig]:
    return SheetConfig.objects.filter(user=owner).order_by("pk").first()


def current_values(owner=None) -> Dict[str, str]:
    """Valeurs en vigueur : celles enregistrées depuis la page, sinon le .env (site) ou rien (compte)."""
    config = saved_config(owner)
    if config is None:
        return {**base_values(owner), "method": ""}
    values = {field: getattr(config, field) or "" for field in FIELDS}
    values["method"] = config.method or ""
    values["private_key"] = _normalize_private_key(values["private_key"])
    values["doc_name"] = values["doc_name"] or DEFAULT_DOC_NAME
    values["sync_tabs"] = values["sync_tabs"] or ",".join(DEFAULT_TABS)
    return values


# Champs qui comptent pour savoir si un compte de service est renseigné (« type » a toujours une valeur par défaut)
ACCOUNT_FIELDS = [field for field in CREDENTIAL_FIELDS if field != "type"]


def _has_account(values: Dict[str, str]) -> bool:
    return all(values.get(field, "").strip() for field in REQUIRED_CREDENTIALS)


def access_mode(values: Optional[Dict[str, str]] = None, owner=None) -> str:
    """'google' (compte Google), 'service_account' (compte de service complet), 'public_link' (lien seul) ou 'none'."""
    values = values or current_values(owner)
    if values.get("method") == "google":
        return "google" if normalize_sheet_id(values.get("sheet_id", "")) else "none"
    if _has_account(values):
        return "service_account"
    if normalize_sheet_id(values.get("sheet_id", "")):
        return "public_link"
    return "none"


def credentials(owner=None) -> Dict[str, str]:
    values = current_values(owner)
    return {field: values[field] for field in CREDENTIAL_FIELDS}


def sheet_id(owner=None) -> str:
    return normalize_sheet_id(current_values(owner)["sheet_id"])


def doc_name(owner=None) -> str:
    return current_values(owner)["doc_name"]


def sync_tabs(owner=None) -> List[str]:
    return parse_tabs(current_values(owner)["sync_tabs"]) or list(DEFAULT_TABS)


# Champs proposés quand on choisit le mode « compte de service » sur la page (sauf la clé privée, jamais envoyée)
ACCOUNT_VIEW_FIELDS = [field for field in CREDENTIAL_FIELDS if field not in SECRET_FIELDS]


def account_to_load(values: Optional[Dict[str, str]] = None, env: Optional[Dict[str, str]] = None, owner=None) -> dict:
    """
    Compte de service à charger dans le formulaire quand on choisit le mode 2 :
    celui enregistré en base s'il est complet, sinon (site seulement) celui du .env, sinon rien.
    """
    values = values if values is not None else current_values(owner)
    env = env if env is not None else base_values(owner)
    for source, candidate in (("page" if saved_config(owner) else "env", values), ("env", env)):
        if _has_account(candidate):
            return {
                "source": source,
                "values": {field: candidate[field] for field in ACCOUNT_VIEW_FIELDS},
                "private_key_set": bool(candidate["private_key"].strip()),
            }
    return {"source": None, "values": {field: "" for field in ACCOUNT_VIEW_FIELDS}, "private_key_set": False}


def google_view(owner=None) -> dict:
    """Mode 3 (compte Google) : disponible sur ce serveur ? personne connectée ? accès à une feuille accordé ?"""
    from accounts import drive  # import différé : accounts dépend des modèles

    account = getattr(owner, "google_account", None) if owner is not None else None
    return {
        "available": drive.is_configured(),
        "signed_in": owner is not None,
        "authorized": drive.is_authorized(owner),
        "email": account.email if account else "",
    }


def public_view(owner=None) -> dict:
    """Ce que la page reçoit : toutes les valeurs sauf la clé privée, remplacée par un indicateur."""
    config = saved_config(owner)
    values = current_values(owner)
    env = base_values(owner)
    return {
        # site : visiteurs non connectés (repli sur le .env) ; account : compte connecté (aucun repli)
        "scope": "site" if owner is None else "account",
        "source": "page" if config else ("env" if owner is None else "none"),
        "mode": access_mode(values),
        "method": values.get("method", ""),
        "google": google_view(owner),
        "updated_at": config.updated_at.isoformat() if config else None,
        "values": {field: values[field] for field in FIELDS if field not in SECRET_FIELDS},
        "private_key_set": bool(values["private_key"].strip()),
        "env": {
            "values": {field: env[field] for field in FIELDS if field not in SECRET_FIELDS},
            "private_key_set": bool(env["private_key"].strip()),
        },
        # Compte de service à proposer en mode 2 : base s'il est complet, sinon .env (clé jamais envoyée)
        "account": account_to_load(values, env, owner),
    }


class ConfigInvalid(Exception):
    """Saisie invalide : errors = {champ: message en français}, codes = {champ: code} pour le site."""

    def __init__(self, errors: Dict[str, str], codes: Dict[str, str]):
        super().__init__("; ".join(errors.values()))
        self.errors = errors
        self.codes = codes


def save(data: dict, owner=None) -> SheetConfig:
    """
    Enregistre les valeurs saisies sur la page.

    La clé privée laissée vide conserve la clé en vigueur (celle déjà enregistrée, ou celle du .env) :
    elle n'est jamais renvoyée au navigateur, le champ arrive donc vide tant qu'on ne la remplace pas.

    clear_credentials (vrai) : retire tout le compte de service, clé comprise -> lecture par lien public.
    Le compte de service est facultatif : vide, la feuille est lue par son lien ; commencé, il doit être complet.
    method="google" (compte connecté seulement) : feuille choisie dans le sélecteur de Google ; le compte de service
    éventuel est retiré, l'identifiant du document (sheet_id) est obligatoire.
    """
    current = current_values(owner)
    google_mode = data.get("method") == "google"
    if google_mode:
        from accounts import drive

        if owner is None:
            raise ConfigInvalid({"method": "Le mode compte Google demande d'être connecté."}, {"method": "google_requires_account"})
        if not drive.is_authorized(owner):
            raise ConfigInvalid(
                {"method": "Autorise d'abord l'accès à une feuille avec ton compte Google."}, {"method": "google_not_authorized"}
            )
    if data.get("clear_credentials") is True or google_mode:
        current = {**current, "private_key": ""}
        data = {**data, **{field: "" for field in ACCOUNT_FIELDS}}
    values = {}
    for field in FIELDS:
        raw = data.get(field, current[field] if field in KEPT_WHEN_ABSENT else "")
        if not isinstance(raw, str):
            raw = "" if raw is None else str(raw)
        values[field] = raw if field == "private_key" else raw.strip()

    if not values["private_key"].strip():
        values["private_key"] = current["private_key"]
    # Compte de service rechargé depuis le .env (mode 2 choisi alors que la base n'en a plus) :
    # la clé du .env est reprise, seulement s'il s'agit du même compte (même e-mail), et seulement pour le site
    if owner is None and not values["private_key"].strip() and data.get("clear_credentials") is not True:
        env = env_values()
        same_account = values["client_email"] and values["client_email"] == env["client_email"].strip()
        if same_account and env["private_key"].strip():
            values["private_key"] = env["private_key"]
    values["private_key"] = _normalize_private_key(values["private_key"]).strip()
    if values["private_key"]:
        values["private_key"] += "\n"
    values["sheet_id"] = normalize_sheet_id(values["sheet_id"])
    values["sync_tabs"] = ",".join(parse_tabs(values["sync_tabs"]))

    errors = {}
    codes = {}  # même erreur, en code stable : le site l'affiche dans la langue choisie
    labels = {
        "type": "Type",
        "project_id": "ID du projet",
        "private_key": "Clé privée",
        "client_email": "E-mail du compte de service",
    }
    # Compte de service : facultatif, mais complet dès qu'un de ses champs est rempli
    account_started = any(values[field].strip() for field in ACCOUNT_FIELDS)
    if account_started:
        for field in REQUIRED_CREDENTIALS:
            if not values[field]:
                errors[field] = f"{labels[field]} : champ obligatoire."
                codes[field] = "required"
    if values["private_key"] and "PRIVATE KEY" not in values["private_key"]:
        errors["private_key"] = "Clé privée : elle doit commencer par -----BEGIN PRIVATE KEY-----."
        codes["private_key"] = "private_key_format"
    if values["client_email"] and "@" not in values["client_email"]:
        errors["client_email"] = "E-mail du compte de service : adresse invalide."
        codes["client_email"] = "email_invalid"
    if google_mode and not values["sheet_id"]:
        errors["sheet_id"] = "Choisis ta feuille dans le sélecteur de Google."
        codes["sheet_id"] = "google_sheet_required"
    elif not account_started and not values["sheet_id"]:
        # Sans compte de service, seul le lien permet de lire la feuille
        errors["sheet_id"] = "Colle le lien du Google Sheet (ou renseigne un compte de service)."
        codes["sheet_id"] = "sheet_link_required"
    elif not values["sheet_id"] and not values["doc_name"]:
        errors["sheet_id"] = "Renseigne l'identifiant du document ou son nom."
        codes["sheet_id"] = "sheet_id_or_name"
    if not values["sync_tabs"]:
        errors["sync_tabs"] = "Indique au moins un onglet à synchroniser."
        codes["sync_tabs"] = "sync_tabs_required"
    if errors:
        raise ConfigInvalid(errors, codes)

    values["method"] = "google" if google_mode else ""
    return _store(owner, values)


def _store(owner, values: Dict[str, str]) -> SheetConfig:
    """Écrit la ligne du propriétaire ; si deux enregistrements se croisent, le second met à jour la ligne créée."""
    for attempt in range(2):
        config = saved_config(owner) or SheetConfig(user=owner)
        for field, value in values.items():
            setattr(config, field, value)
        try:
            with transaction.atomic():
                config.save()
            return config
        except IntegrityError:  # ligne créée entre-temps (contrainte : une configuration par propriétaire)
            if attempt:
                raise
    return config


def save_tabs(raw, owner=None) -> SheetConfig:
    """
    Enregistre seulement la liste des onglets à synchroniser (section Onglet de la page GoogleSheet).

    Sans ligne enregistrée, les valeurs en vigueur (.env pour le site, rien pour un compte) sont reprises telles
    quelles dans la ligne créée, comme le fait le formulaire de connexion : le mode d'accès ne change pas.
    « Revenir au .env » (ou « Effacer » pour un compte) l'efface.
    """
    tabs = parse_tabs(raw if isinstance(raw, str) else "")
    if not tabs:
        raise ConfigInvalid({"sync_tabs": "Indique au moins un onglet à synchroniser."}, {"sync_tabs": "sync_tabs_required"})
    config = saved_config(owner)
    if config is None:
        values = current_values(owner)
        if values["private_key"].strip():
            values["private_key"] = values["private_key"].strip() + "\n"
        return _store(owner, {**values, "sync_tabs": ",".join(tabs)})
    config.sync_tabs = ",".join(tabs)
    config.save()
    return config


def reset(owner=None) -> None:
    """Supprime les valeurs saisies : le .env s'applique de nouveau (site), ou plus rien n'est configuré (compte)."""
    SheetConfig.objects.filter(user=owner).delete()
