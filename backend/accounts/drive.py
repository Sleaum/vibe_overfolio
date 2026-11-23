"""
Mode 3 de la page GoogleSheet : lire SA feuille avec SON compte Google.

La personne connectée autorise Overfolio (scope drive.file : seulement les fichiers qu'elle choisit dans le
sélecteur de Google, le « Picker »), puis choisit sa feuille. Le jeton de rafraîchissement reçu est gardé en base,
chiffré (Fernet, clé FIELD_ENCRYPTION_KEY) ; il n'est jamais renvoyé au navigateur. Le Picker reçoit seulement
un jeton d'accès de courte durée (picker_token).

Réglages du .env, en plus de ceux de la connexion (accounts/google.py) :
  GOOGLE_PICKER_API_KEY        clé API (Google Cloud, limitée à l'API Google Picker et à ton domaine)
  GOOGLE_CLOUD_PROJECT_NUMBER  numéro du projet Google Cloud (appId du Picker)
  FIELD_ENCRYPTION_KEY         clé Fernet (python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())")
"""
import logging
import os

import requests
from cryptography.fernet import Fernet, InvalidToken
from django.utils import timezone
from google.auth.exceptions import RefreshError
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials

from . import google

logger = logging.getLogger(__name__)

DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file"
REVOKE_URI = "https://oauth2.googleapis.com/revoke"


class DriveError(Exception):
    """Accès à la feuille impossible ; `code` est traduit par le site (rubrique apiErrors)."""

    def __init__(self, message, code, status=400):
        super().__init__(message)
        self.code = code
        self.status = status


def settings_values():
    return {
        "api_key": os.getenv("GOOGLE_PICKER_API_KEY", "").strip(),
        "app_id": os.getenv("GOOGLE_CLOUD_PROJECT_NUMBER", "").strip(),
        "encryption_key": os.getenv("FIELD_ENCRYPTION_KEY", "").strip(),
    }


def _fernet():
    key = settings_values()["encryption_key"]
    if not key:
        return None
    try:
        return Fernet(key.encode())
    except (ValueError, TypeError):
        logger.error("FIELD_ENCRYPTION_KEY n'est pas une clé Fernet valable")
        return None


def is_configured() -> bool:
    """Mode 3 disponible : connexion Google réglée, clé API et numéro de projet du Picker, clé de chiffrement valable."""
    values = settings_values()
    return google.is_configured() and bool(values["api_key"] and values["app_id"]) and _fernet() is not None


def encrypt(text: str) -> str:
    fernet = _fernet()
    if fernet is None:
        raise DriveError("Clé de chiffrement absente ou invalide (FIELD_ENCRYPTION_KEY).", "google_drive_not_configured", 503)
    return fernet.encrypt(text.encode()).decode()


def decrypt(token: str) -> str:
    fernet = _fernet()
    if fernet is None:
        raise DriveError("Clé de chiffrement absente ou invalide (FIELD_ENCRYPTION_KEY).", "google_drive_not_configured", 503)
    try:
        return fernet.decrypt(token.encode()).decode()
    except InvalidToken:
        # Clé changée depuis l'autorisation : il faut autoriser de nouveau
        raise DriveError("Accès Google à autoriser de nouveau.", "google_not_authorized", 409)


def _account(user):
    return getattr(user, "google_account", None) if user is not None and user.is_authenticated else None


def is_authorized(user) -> bool:
    account = _account(user)
    return bool(account and account.drive_refresh_token)


def store_refresh_token(account, refresh_token: str) -> None:
    account.drive_refresh_token = encrypt(refresh_token)
    account.drive_authorized_at = timezone.now()
    account.save(update_fields=["drive_refresh_token", "drive_authorized_at", "updated_at"])


def credentials(user) -> Credentials:
    """Identifiants Google de la personne, pour lire la feuille choisie (gspread, Picker)."""
    account = _account(user)
    if not account or not account.drive_refresh_token:
        raise DriveError("Autorise d'abord l'accès à une feuille avec ton compte Google.", "google_not_authorized", 409)
    try:
        refresh_token = decrypt(account.drive_refresh_token)
    except DriveError as exc:
        if exc.code == "google_not_authorized":  # clé de chiffrement changée : on oublie, la page repropose l'accord
            forget(user)
        raise
    values = google.settings_values()
    return Credentials(
        token=None,
        refresh_token=refresh_token,
        token_uri=google.TOKEN_URI,
        client_id=values["client_id"],
        client_secret=values["client_secret"],
        scopes=[DRIVE_SCOPE],
    )


def fresh_credentials(user) -> Credentials:
    """Identifiants avec un jeton d'accès valable (rafraîchi chez Google)."""
    creds = credentials(user)
    try:
        creds.refresh(Request())
    except RefreshError as exc:
        details = exc.args[1] if len(exc.args) > 1 and isinstance(exc.args[1], dict) else {}
        revoked = details.get("error") == "invalid_grant" or "invalid_grant" in str(exc.args[0] if exc.args else "")
        if revoked and not getattr(exc, "retryable", False):
            # Accès retiré dans le compte Google, ou jeton expiré : on oublie le jeton
            forget(user)
            raise DriveError("L'accès Google a été retiré : autorise-le de nouveau.", "google_access_revoked", 409)
        # Google indisponible, ou réglage OAuth du serveur faux : l'accès est gardé
        raise DriveError("Google refuse ou ne répond pas pour le moment.", "google_unreachable", 502)
    except Exception as exc:
        raise DriveError(f"Google injoignable : {exc.__class__.__name__}", "google_unreachable", 502)
    return creds


def picker_token(user) -> dict:
    """Ce dont le sélecteur de Google a besoin côté navigateur : jeton d'accès court, clé API, numéro de projet."""
    if not is_configured():
        raise DriveError("Mode compte Google non configuré sur ce serveur.", "google_drive_not_configured", 503)
    creds = fresh_credentials(user)
    values = settings_values()
    expires_in = None
    if creds.expiry is not None:
        expires_in = max(0, int((creds.expiry - timezone.now().replace(tzinfo=None)).total_seconds()))
    return {
        "access_token": creds.token,
        "expires_in": expires_in,
        "api_key": values["api_key"],
        "app_id": values["app_id"],
    }


def forget(user) -> None:
    account = _account(user)
    if account and account.drive_refresh_token:
        account.drive_refresh_token = ""
        account.drive_authorized_at = None
        account.save(update_fields=["drive_refresh_token", "drive_authorized_at", "updated_at"])


def revoke(user) -> None:
    """Retire l'accès : chez Google (au mieux) et en base (toujours)."""
    account = _account(user)
    if not account or not account.drive_refresh_token:
        return
    try:
        token = decrypt(account.drive_refresh_token)
        requests.post(REVOKE_URI, data={"token": token}, timeout=10)
    except Exception:  # l'accès est oublié ici même si Google ne répond pas
        logger.warning("Révocation chez Google impossible ; accès oublié en base")
    forget(user)
