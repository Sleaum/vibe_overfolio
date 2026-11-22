"""
Paramètres d'accès au Google Sheet.

Ils sont saisis sur la page GoogleSheet et enregistrés en base (modèle SheetConfig).
Tant que rien n'a été enregistré, les valeurs du .env s'appliquent : ce sont aussi
les valeurs proposées par défaut dans le formulaire.

Deux façons de lire la feuille (access_mode) :
- « service_account » : un compte de service complet est renseigné -> API Google Sheets (feuille privée possible) ;
- « public_link » : pas de compte de service, seulement le lien -> export d'une feuille partagée par lien ;
- « none » : ni l'un ni l'autre.
"""
import os
import re
from typing import Dict, List, Optional

from .models import SheetConfig

DEFAULT_TABS = ["portfolio", "inout", "stock", "budget", "_history"]
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


def env_values() -> Dict[str, str]:
    """Valeurs du .env (et valeurs par défaut quand une variable est absente)."""
    values = {field: os.getenv(var, "") or "" for field, var in ENV_VARS.items()}
    values["private_key"] = _normalize_private_key(values["private_key"])
    values["type"] = values["type"] or "service_account"
    values["doc_name"] = values["doc_name"] or DEFAULT_DOC_NAME
    values["sync_tabs"] = values["sync_tabs"] or ",".join(DEFAULT_TABS)
    return values


def saved_config() -> Optional[SheetConfig]:
    return SheetConfig.objects.filter(pk=1).first()


def current_values() -> Dict[str, str]:
    """Valeurs en vigueur : celles enregistrées depuis la page, sinon celles du .env."""
    config = saved_config()
    if config is None:
        return env_values()
    values = {field: getattr(config, field) or "" for field in FIELDS}
    values["private_key"] = _normalize_private_key(values["private_key"])
    values["doc_name"] = values["doc_name"] or DEFAULT_DOC_NAME
    values["sync_tabs"] = values["sync_tabs"] or ",".join(DEFAULT_TABS)
    return values


# Champs qui comptent pour savoir si un compte de service est renseigné (« type » a toujours une valeur par défaut)
ACCOUNT_FIELDS = [field for field in CREDENTIAL_FIELDS if field != "type"]


def _has_account(values: Dict[str, str]) -> bool:
    return all(values.get(field, "").strip() for field in REQUIRED_CREDENTIALS)


def access_mode(values: Optional[Dict[str, str]] = None) -> str:
    """'service_account' (compte de service complet), 'public_link' (lien seul) ou 'none'."""
    values = values or current_values()
    if _has_account(values):
        return "service_account"
    if normalize_sheet_id(values.get("sheet_id", "")):
        return "public_link"
    return "none"


def credentials() -> Dict[str, str]:
    values = current_values()
    return {field: values[field] for field in CREDENTIAL_FIELDS}


def sheet_id() -> str:
    return normalize_sheet_id(current_values()["sheet_id"])


def doc_name() -> str:
    return current_values()["doc_name"]


def sync_tabs() -> List[str]:
    return parse_tabs(current_values()["sync_tabs"]) or list(DEFAULT_TABS)


def public_view() -> dict:
    """Ce que la page reçoit : toutes les valeurs sauf la clé privée, remplacée par un indicateur."""
    config = saved_config()
    values = current_values()
    env = env_values()
    return {
        "source": "page" if config else "env",
        "mode": access_mode(values),
        "updated_at": config.updated_at.isoformat() if config else None,
        "values": {field: values[field] for field in FIELDS if field not in SECRET_FIELDS},
        "private_key_set": bool(values["private_key"].strip()),
        "env": {
            "values": {field: env[field] for field in FIELDS if field not in SECRET_FIELDS},
            "private_key_set": bool(env["private_key"].strip()),
        },
    }


class ConfigInvalid(Exception):
    """Saisie invalide : errors = {champ: message en français}, codes = {champ: code} pour le site."""

    def __init__(self, errors: Dict[str, str], codes: Dict[str, str]):
        super().__init__("; ".join(errors.values()))
        self.errors = errors
        self.codes = codes


def save(data: dict) -> SheetConfig:
    """
    Enregistre les valeurs saisies sur la page.

    La clé privée laissée vide conserve la clé en vigueur (celle déjà enregistrée, ou celle du .env) :
    elle n'est jamais renvoyée au navigateur, le champ arrive donc vide tant qu'on ne la remplace pas.

    clear_credentials (vrai) : retire tout le compte de service, clé comprise -> lecture par lien public.
    Le compte de service est facultatif : vide, la feuille est lue par son lien ; commencé, il doit être complet.
    """
    current = current_values()
    if data.get("clear_credentials") is True:
        current = {**current, "private_key": ""}
        data = {**data, **{field: "" for field in ACCOUNT_FIELDS}}
    values = {}
    for field in FIELDS:
        raw = data.get(field, current[field] if field in SECRET_FIELDS else "")
        if not isinstance(raw, str):
            raw = "" if raw is None else str(raw)
        values[field] = raw if field == "private_key" else raw.strip()

    if not values["private_key"].strip():
        values["private_key"] = current["private_key"]
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
    if not account_started and not values["sheet_id"]:
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

    config, _ = SheetConfig.objects.update_or_create(pk=1, defaults=values)
    return config


def reset() -> None:
    """Supprime les valeurs saisies : le .env s'applique de nouveau."""
    SheetConfig.objects.filter(pk=1).delete()
