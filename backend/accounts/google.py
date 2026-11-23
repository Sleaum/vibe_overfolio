"""
Connexion avec Google (OAuth 2.0, flux « authorization code » côté serveur, avec PKCE).

Réglages lus dans le .env à chaque appel (voir README, « Connexion avec Google ») :
  GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET : client OAuth « Application Web » de Google Cloud ;
  GOOGLE_OAUTH_REDIRECT_URI : adresse de retour, identique à celle déclarée dans Google Cloud
    (par exemple http://localhost/api/auth/google/callback/).
Sans ces trois valeurs, la connexion est désactivée : le site fonctionne sans comptes.
"""
import os

from google.auth import exceptions as google_exceptions
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token
from google_auth_oauthlib.flow import Flow

# Google peut renvoyer plus de scopes que demandés (autorisations déjà accordées) : ce n'est pas une erreur
os.environ.setdefault("OAUTHLIB_RELAX_TOKEN_SCOPE", "1")

AUTH_URI = "https://accounts.google.com/o/oauth2/auth"
TOKEN_URI = "https://oauth2.googleapis.com/token"

# Connexion : identité seulement (nom, e-mail, photo)
LOGIN_SCOPES = [
    "openid",
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/userinfo.profile",
]


class GoogleAuthError(Exception):
    """Échec de la connexion Google ; `code` est traduit par le site (rubrique apiErrors)."""

    def __init__(self, message, code):
        super().__init__(message)
        self.code = code


def settings_values():
    return {
        "client_id": os.getenv("GOOGLE_OAUTH_CLIENT_ID", "").strip(),
        "client_secret": os.getenv("GOOGLE_OAUTH_CLIENT_SECRET", "").strip(),
        "redirect_uri": os.getenv("GOOGLE_OAUTH_REDIRECT_URI", "").strip(),
    }


def is_configured() -> bool:
    return all(settings_values().values())


def make_flow(scopes=None, code_verifier=None) -> Flow:
    values = settings_values()
    client_config = {
        "web": {
            "client_id": values["client_id"],
            "client_secret": values["client_secret"],
            "auth_uri": AUTH_URI,
            "token_uri": TOKEN_URI,
            "redirect_uris": [values["redirect_uri"]],
        }
    }
    return Flow.from_client_config(
        client_config,
        scopes=scopes or LOGIN_SCOPES,
        redirect_uri=values["redirect_uri"],
        code_verifier=code_verifier,
        autogenerate_code_verifier=code_verifier is None,
    )


def authorization_url(scopes=None):
    """Adresse de la page Google, `state` et vérificateur PKCE à garder en session jusqu'au retour."""
    flow = make_flow(scopes)
    url, state = flow.authorization_url(
        access_type="online",  # pas de jeton de rafraîchissement : la connexion n'en a pas besoin
        include_granted_scopes="true",
        prompt="select_account",
    )
    return url, state, flow.code_verifier


def exchange_code(code: str, code_verifier: str) -> dict:
    """
    Échange le code reçu au retour de Google contre les jetons, puis vérifie le jeton d'identité
    (signature, émetteur, destinataire = notre client, expiration). Renvoie ses informations (sub, email…).
    """
    flow = make_flow(code_verifier=code_verifier)
    try:
        tokens = flow.fetch_token(code=code) or {}
    except Exception as exc:  # réseau, code expiré ou déjà utilisé, secret erroné…
        raise GoogleAuthError(f"Échange du code refusé par Google : {exc.__class__.__name__}", "google_token_failed")
    token = tokens.get("id_token")
    if not token:
        raise GoogleAuthError("Google n'a pas renvoyé de jeton d'identité.", "google_token_invalid")
    try:
        # 10 s de tolérance : une horloge serveur un peu en retard ne doit pas refuser toutes les connexions
        claims = id_token.verify_oauth2_token(
            token, google_requests.Request(), settings_values()["client_id"], clock_skew_in_seconds=10
        )
    except google_exceptions.TransportError:  # certificats de Google injoignables
        raise GoogleAuthError("Google injoignable pour vérifier le jeton.", "google_token_failed")
    except (ValueError, google_exceptions.GoogleAuthError):  # signature, émetteur, destinataire, dates
        raise GoogleAuthError("Jeton d'identité Google invalide.", "google_token_invalid")
    if not claims.get("sub"):
        raise GoogleAuthError("Jeton d'identité Google sans identifiant.", "google_token_invalid")
    if not claims.get("email") or not claims.get("email_verified"):
        raise GoogleAuthError("Adresse e-mail Google non vérifiée.", "google_email_unverified")
    return claims
