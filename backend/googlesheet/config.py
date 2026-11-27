"""
Paramètres d'accès au Google Sheet.

Ils sont saisis sur la page GoogleSheet et enregistrés en base (modèle SheetConfig).
Tant que rien n'a été enregistré, les valeurs du .env s'appliquent : ce sont aussi
les valeurs proposées par défaut dans le formulaire.

Trois façons de lire la feuille (SheetSettings.mode) :
- « service_account » : un compte de service complet est renseigné -> API Google Sheets (feuille privée possible) ;
- « public_link » : pas de compte de service, seulement le lien -> export d'une feuille partagée par lien ;
- « google » : compte Google de la personne connectée (feuille choisie dans le sélecteur de Google, scope drive.file) ;
- « none » : rien de configuré.

Propriétaire (`owner`) : None = le site (visiteurs non connectés), sinon un utilisateur connecté.
Chaque propriétaire a sa propre configuration (une ligne SheetConfig) et ses propres tables.
Le .env ne sert que pour le site : un compte n'en hérite jamais (ni lien, ni compte de service, ni clé).

La configuration est lue une fois par opération (load_settings : une requête) puis passée telle quelle :
open_spreadsheet, sync_sheets et les vues travaillent sur ce SheetSettings.
"""
import datetime
import json
import logging
import os
import re
from dataclasses import dataclass, replace
from types import MappingProxyType
from typing import Dict, List, Mapping, Optional

from django.db import IntegrityError, transaction

from core import crypto

from .models import SheetConfig

logger = logging.getLogger(__name__)

DEFAULT_TABS = ["portfolio", "inout", "stock", "budget", "history"]
DEFAULT_DOC_NAME = "overfolio"


@dataclass(frozen=True)
class Field:
    """
    Un champ de la configuration : variable du .env, et son rôle. En base, un champ du document est une colonne de
    SheetConfig ; ceux du compte de service sont dans le JSON chiffré de SheetConfig.service_account.
    """

    name: str
    env: str
    credential: bool = False  # champ du fichier JSON du compte de service
    secret: bool = False  # jamais renvoyé au navigateur
    required: str = ""  # libellé du champ s'il est obligatoire dans un compte de service commencé
    default: str = ""


# Ordre : celui du fichier JSON de Google pour le compte de service, puis le document
FIELDS = (
    Field("type", "TYPE", credential=True, required="Type", default="service_account"),
    Field("project_id", "PROJECT_ID", credential=True, required="ID du projet"),
    Field("private_key_id", "PRIVATE_KEY_ID", credential=True),
    Field("private_key", "PRIVATE_KEY", credential=True, secret=True, required="Clé privée"),
    Field("client_email", "CLIENT_EMAIL", credential=True, required="E-mail du compte de service"),
    Field("client_id", "CLIENT_ID", credential=True),
    Field("auth_uri", "AUTH_URI", credential=True),
    Field("token_uri", "TOKEN_URI", credential=True),
    Field("auth_provider_x509_cert_url", "AUTH_PROVIDER_X509_CERT_URL", credential=True),
    Field("client_x509_cert_url", "CLIENT_X509_CERT_URL", credential=True),
    Field("universe_domain", "UNIVERSE_DOMAIN", credential=True),
    Field("sheet_id", "GOOGLE_SHEET_ID"),
    Field("doc_name", "GOOGLE_SHEET_DOC_NAME", default=DEFAULT_DOC_NAME),
    Field("sync_tabs", "SHEET_SYNC_TABS", default=",".join(DEFAULT_TABS)),
)

FIELD_NAMES = [field.name for field in FIELDS]
CREDENTIAL_FIELDS = [field.name for field in FIELDS if field.credential]
SECRET_FIELDS = {field.name for field in FIELDS if field.secret}
PUBLIC_FIELDS = [field.name for field in FIELDS if not field.secret]
REQUIRED_CREDENTIALS = {field.name: field.required for field in FIELDS if field.required}
# Champs qui disent si un compte de service est commencé (« type » a toujours une valeur par défaut)
ACCOUNT_FIELDS = [field.name for field in FIELDS if field.credential and not field.default]
# Compte de service proposé quand on choisit le mode 2 sur la page (sans la clé privée)
ACCOUNT_VIEW_FIELDS = [field.name for field in FIELDS if field.credential and not field.secret]
# Gardés quand un enregistrement ne les contient pas : la clé privée (jamais renvoyée), et les onglets,
# réglés sur la page à part du formulaire de connexion (save_tabs)
KEPT_WHEN_ABSENT = SECRET_FIELDS | {"sync_tabs"}

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
    return {field.name: field.default for field in FIELDS}


def env_values() -> Dict[str, str]:
    """Valeurs du .env (et valeurs par défaut quand une variable est absente)."""
    values = {field.name: os.getenv(field.env, "") or field.default for field in FIELDS}
    values["private_key"] = _normalize_private_key(values["private_key"])
    return values


def base_values(owner=None) -> Dict[str, str]:
    """Valeurs quand rien n'est enregistré : le .env pour le site, rien pour un compte."""
    return env_values() if owner is None else default_values()


def _read_account(row: SheetConfig) -> Optional[Dict[str, str]]:
    """
    Compte de service d'une ligne enregistrée, déchiffré ({} si la ligne n'en a pas). None s'il est illisible
    (clé de chiffrement changée sans garder l'ancienne) : la page le redemande, avec sa clé privée.
    """
    if not row.service_account:
        return {}
    try:
        account = json.loads(crypto.decrypt(row.service_account))
    except (crypto.DecryptError, ValueError):
        logger.warning("Compte de service enregistré illisible (configuration %s) : clé de chiffrement changée ?", row.pk)
        return None
    return account if isinstance(account, dict) else None


def _write_account(values: Mapping[str, str]) -> str:
    """JSON chiffré des champs du compte de service, ou "" s'ils sont tous vides."""
    account = {field: values.get(field, "") for field in CREDENTIAL_FIELDS}
    return crypto.encrypt(json.dumps(account)) if any(account.values()) else ""


def _row_values(row: SheetConfig) -> Dict[str, str]:
    """Valeurs d'une ligne enregistrée. Seuls les champs du document reprennent leur valeur par défaut :
    un compte de service enregistré est gardé tel quel, un champ vide reste vide."""
    account = _read_account(row)
    values = {}
    for field in FIELDS:
        if field.credential:
            # Illisible : valeurs d'un compte neuf (type par défaut), pour le saisir de nouveau
            values[field.name] = field.default if account is None else str(account.get(field.name) or "")
        else:
            values[field.name] = getattr(row, field.name) or field.default
    values["private_key"] = _normalize_private_key(values["private_key"])
    values["method"] = row.method or ""
    return values


def _has_account(values: Mapping[str, str]) -> bool:
    return all(values.get(field, "").strip() for field in REQUIRED_CREDENTIALS)


def _mode(values: Mapping[str, str]) -> str:
    if values.get("method") == "google":
        return "google" if normalize_sheet_id(values.get("sheet_id", "")) else "none"
    if _has_account(values):
        return "service_account"
    if normalize_sheet_id(values.get("sheet_id", "")):
        return "public_link"
    return "none"


@dataclass(frozen=True)
class SheetSettings:
    """
    Configuration en vigueur d'un propriétaire, lue une fois (load_settings) puis passée telle quelle.

    `values` : toutes les valeurs, clé privée comprise, et « method » ; en lecture seule.
    `source` : « page » (enregistrée sur la page GoogleSheet), « env » (le .env du site), « none » (compte sans
    configuration).
    """

    owner: object
    source: str
    values: Mapping[str, str]
    updated_at: Optional[datetime.datetime] = None

    @property
    def scope(self) -> str:
        """« site » (visiteurs non connectés, repli sur le .env) ou « account » (compte connecté, aucun repli)."""
        return "site" if self.owner is None else "account"

    @property
    def method(self) -> str:
        return self.values.get("method", "")

    @property
    def mode(self) -> str:
        """'google' (compte Google), 'service_account' (compte de service complet), 'public_link' (lien seul) ou 'none'."""
        return _mode(self.values)

    @property
    def has_service_account(self) -> bool:
        return _has_account(self.values)

    @property
    def private_key_set(self) -> bool:
        return bool(self.values["private_key"].strip())

    @property
    def sheet_id(self) -> str:
        return normalize_sheet_id(self.values["sheet_id"])

    @property
    def doc_name(self) -> str:
        return self.values["doc_name"]

    @property
    def tabs(self) -> List[str]:
        """Onglets à synchroniser : ceux de la page, sinon SHEET_SYNC_TABS (site), sinon la liste par défaut."""
        return parse_tabs(self.values["sync_tabs"]) or list(DEFAULT_TABS)

    @property
    def credentials(self) -> Dict[str, str]:
        return {field: self.values[field] for field in CREDENTIAL_FIELDS}

    def with_doc_name(self, doc_name: str) -> "SheetSettings":
        """Même configuration, autre nom de document (option --doc de la commande sync_sheets)."""
        return replace(self, values=MappingProxyType({**self.values, "doc_name": doc_name}))


def _saved_row(owner=None) -> Optional[SheetConfig]:
    return SheetConfig.objects.filter(user=owner).order_by("pk").first()


def settings_from_row(row: Optional[SheetConfig], owner=None) -> SheetSettings:
    """Configuration en vigueur, d'après la ligne enregistrée du propriétaire (ou son absence) : aucune requête."""
    if row is None:
        values = {**base_values(owner), "method": ""}
        return SheetSettings(owner, "env" if owner is None else "none", MappingProxyType(values))
    return SheetSettings(owner, "page", MappingProxyType(_row_values(row)), row.updated_at)


def load_settings(owner=None) -> SheetSettings:
    """Configuration en vigueur : celle enregistrée depuis la page, sinon le .env (site) ou rien (compte). Une requête."""
    return settings_from_row(_saved_row(owner), owner)


def account_to_load(settings: SheetSettings, env: Mapping[str, str]) -> dict:
    """
    Compte de service à charger dans le formulaire quand on choisit le mode 2 :
    celui enregistré en base s'il est complet, sinon (site seulement) celui du .env, sinon rien.
    """
    current = ("page" if settings.source == "page" else "env", settings.values)
    for source, candidate in (current, ("env", env)):
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


def public_view(settings: SheetSettings) -> dict:
    """Ce que la page reçoit : toutes les valeurs sauf la clé privée, remplacée par un indicateur."""
    env = base_values(settings.owner)
    return {
        "scope": settings.scope,
        "source": settings.source,
        "mode": settings.mode,
        "method": settings.method,
        "google": google_view(settings.owner),
        "updated_at": settings.updated_at.isoformat() if settings.updated_at else None,
        "values": {field: settings.values[field] for field in PUBLIC_FIELDS},
        "private_key_set": settings.private_key_set,
        "env": {
            "values": {field: env[field] for field in PUBLIC_FIELDS},
            "private_key_set": bool(env["private_key"].strip()),
        },
        # Compte de service à proposer en mode 2 : base s'il est complet, sinon .env (clé jamais envoyée)
        "account": account_to_load(settings, env),
    }


class ConfigInvalid(Exception):
    """Saisie invalide : errors = {champ: message en français}, codes = {champ: code} pour le site."""

    def __init__(self, errors: Dict[str, str], codes: Dict[str, str]):
        super().__init__("; ".join(errors.values()))
        self.errors = errors
        self.codes = codes


def save(data: dict, owner=None) -> SheetSettings:
    """
    Enregistre les valeurs saisies sur la page ; renvoie la configuration enregistrée.

    La clé privée laissée vide conserve la clé en vigueur (celle déjà enregistrée, ou celle du .env) :
    elle n'est jamais renvoyée au navigateur, le champ arrive donc vide tant qu'on ne la remplace pas.

    clear_credentials (vrai) : retire tout le compte de service, clé comprise -> lecture par lien public.
    Le compte de service est facultatif : vide, la feuille est lue par son lien ; commencé, il doit être complet.
    method="google" (compte connecté seulement) : feuille choisie dans le sélecteur de Google ; le compte de service
    éventuel est retiré, l'identifiant du document (sheet_id) est obligatoire.
    """
    row = _saved_row(owner)
    google_mode = data.get("method") == "google"
    if google_mode:
        _check_google_mode(owner)
    clear_account = data.get("clear_credentials") is True or google_mode
    values = _merge(data, settings_from_row(row, owner).values, clear_account)
    if owner is None and data.get("clear_credentials") is not True:
        _key_from_env(values)
    _tidy(values)
    _validate(values, google_mode)
    values["method"] = "google" if google_mode else ""
    return settings_from_row(_store(owner, values, row), owner)


def _check_google_mode(owner) -> None:
    from accounts import drive

    if owner is None:
        raise ConfigInvalid({"method": "Le mode compte Google demande d'être connecté."}, {"method": "google_requires_account"})
    if not drive.is_authorized(owner):
        raise ConfigInvalid(
            {"method": "Autorise d'abord l'accès à une feuille avec ton compte Google."}, {"method": "google_not_authorized"}
        )


def _merge(data: dict, current: Mapping[str, str], clear_account: bool) -> Dict[str, str]:
    """
    Valeurs saisies, complétées par celles en vigueur pour les champs gardés quand ils manquent (clé privée, onglets).
    clear_account : le compte de service est retiré, clé comprise.
    """
    if clear_account:
        current = {**current, "private_key": ""}
        data = {**data, **{field: "" for field in ACCOUNT_FIELDS}}
    values = {}
    for field in FIELD_NAMES:
        raw = data.get(field, current[field] if field in KEPT_WHEN_ABSENT else "")
        if not isinstance(raw, str):
            raw = "" if raw is None else str(raw)
        values[field] = raw if field == "private_key" else raw.strip()
    if not values["private_key"].strip():
        values["private_key"] = current["private_key"]
    return values


def _key_from_env(values: Dict[str, str]) -> None:
    """
    Site seulement : compte de service rechargé depuis le .env (mode 2 choisi alors que la base n'en a plus).
    La clé du .env est reprise, seulement s'il s'agit du même compte (même e-mail).
    """
    if values["private_key"].strip():
        return
    env = env_values()
    same_account = values["client_email"] and values["client_email"] == env["client_email"].strip()
    if same_account and env["private_key"].strip():
        values["private_key"] = env["private_key"]


def _tidy(values: Dict[str, str]) -> None:
    """Forme enregistrée : clé terminée par un saut de ligne, identifiant du document seul, onglets sans espaces."""
    values["private_key"] = _normalize_private_key(values["private_key"]).strip()
    if values["private_key"]:
        values["private_key"] += "\n"
    values["sheet_id"] = normalize_sheet_id(values["sheet_id"])
    values["sync_tabs"] = ",".join(parse_tabs(values["sync_tabs"]))


def _validate(values: Dict[str, str], google_mode: bool) -> None:
    """Lève ConfigInvalid avec un message et un code stable par champ en erreur."""
    errors = {}
    codes = {}  # même erreur, en code stable : le site l'affiche dans la langue choisie
    # Compte de service : facultatif, mais complet dès qu'un de ses champs est rempli
    account_started = any(values[field].strip() for field in ACCOUNT_FIELDS)
    if account_started:
        for field, label in REQUIRED_CREDENTIALS.items():
            if not values[field]:
                errors[field] = f"{label} : champ obligatoire."
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


def _store(owner, values: Dict[str, str], row: Optional[SheetConfig] = None) -> SheetConfig:
    """
    Écrit la ligne du propriétaire (`row`, déjà lue, ou une nouvelle). Si deux enregistrements se croisent,
    le second relit la ligne créée entre-temps et la met à jour.
    """
    for attempt in range(2):
        if attempt:
            row = _saved_row(owner)
        row = row or SheetConfig(user=owner)
        for field, value in values.items():
            if field not in CREDENTIAL_FIELDS:
                setattr(row, field, value)
        row.service_account = _write_account(values)
        try:
            with transaction.atomic():
                row.save()
            return row
        except IntegrityError:  # ligne créée entre-temps (contrainte : une configuration par propriétaire)
            if attempt:
                raise
    return row


def save_tabs(raw, owner=None) -> SheetSettings:
    """
    Enregistre seulement la liste des onglets à synchroniser (section Onglet de la page GoogleSheet) ;
    renvoie la configuration enregistrée.

    Sans ligne enregistrée, les valeurs en vigueur (.env pour le site, rien pour un compte) sont reprises telles
    quelles dans la ligne créée, comme le fait le formulaire de connexion : le mode d'accès ne change pas.
    « Revenir au .env » (ou « Effacer » pour un compte) l'efface.
    """
    tabs = parse_tabs(raw if isinstance(raw, str) else "")
    if not tabs:
        raise ConfigInvalid({"sync_tabs": "Indique au moins un onglet à synchroniser."}, {"sync_tabs": "sync_tabs_required"})
    row = _saved_row(owner)
    if row is None:
        values = dict(settings_from_row(None, owner).values)
        if values["private_key"].strip():
            values["private_key"] = values["private_key"].strip() + "\n"
        row = _store(owner, {**values, "sync_tabs": ",".join(tabs)})
    else:
        row.sync_tabs = ",".join(tabs)
        row.save()
    return settings_from_row(row, owner)


def reset(owner=None) -> SheetSettings:
    """Supprime les valeurs saisies : le .env s'applique de nouveau (site), ou plus rien n'est configuré (compte)."""
    SheetConfig.objects.filter(user=owner).delete()
    return settings_from_row(None, owner)
