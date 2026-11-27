"""
Connexion avec Google, par session Django.

  GET  /api/auth/google/start/?next=/page : part vers Google (state et PKCE gardés en session)
  GET  /api/auth/google/callback/         : retour de Google -> connexion, puis retour sur `next`
                                            (en cas d'échec : /newpage?error=<code>)
  GET  /api/auth/me/                      : état de la connexion ; pose aussi le cookie CSRF du site
  POST /api/auth/logout/                  : déconnexion (jeton CSRF exigé si une session est ouverte)

Mode 3 de la page GoogleSheet (compte connecté) :
  GET  /api/auth/google/drive/start/?next=/sheet : autorise l'accès aux feuilles choisies (scope drive.file) ;
                                                   retour sur `next` avec ?google=connected ou ?google_error=<code>
  GET  /api/auth/google/picker-token/            : jeton d'accès court pour le sélecteur de Google
  POST /api/auth/google/drive/revoke/            : retire l'accès (chez Google et en base)
"""
import posixpath
from urllib.parse import parse_qsl, quote, unquote, urlencode, urlsplit, urlunsplit

from django.contrib.auth import login, logout
from django.http import JsonResponse
from django.middleware.csrf import get_token
from django.shortcuts import redirect
from django.utils.crypto import constant_time_compare
from django.views.decorators.http import require_GET
from rest_framework.decorators import api_view

from core.errors import error_response

from . import drive, google
from .services import user_for_google

SESSION_KEY = "google_oauth"
LOGIN_PAGE = "/newpage"


def safe_next(value) -> str:
    """Adresse de retour après connexion : une page du site seulement (jamais un autre site ni l'API)."""
    value = value if isinstance(value, str) else ""
    if (
        not value.startswith("/")
        or value.startswith("//")
        or "\\" in value
        or any(ord(char) < 32 for char in value)
        or len(value) > 500
    ):
        return "/"
    # Chemin tel que le navigateur et nginx le liront (%61pi, /./api…) : jamais l'API
    path = posixpath.normpath(unquote(value.split("?", 1)[0].split("#", 1)[0]))
    if path == "/api" or path.startswith("/api/") or path.startswith("//"):
        return "/"
    return value


def _fail(code):
    return redirect(f"{LOGIN_PAGE}?error={code}")


def with_param(url: str, name: str, value: str) -> str:
    """Ajoute (ou remplace) un paramètre à une adresse du site."""
    parts = urlsplit(url)
    query = [(key, val) for key, val in parse_qsl(parts.query, keep_blank_values=True) if key not in (name, "google", "google_error")]
    query.append((name, value))
    return urlunsplit(("", "", parts.path, urlencode(query), parts.fragment))


@require_GET
def google_start(request):
    if not google.is_configured():
        return _fail("google_not_configured")
    url, state, code_verifier = google.authorization_url()
    request.session[SESSION_KEY] = {
        "state": state,
        "code_verifier": code_verifier,
        "next": safe_next(request.GET.get("next")),
    }
    return redirect(url)


@require_GET
def google_callback(request):
    pending = request.session.pop(SESSION_KEY, None)  # à usage unique
    state = request.GET.get("state", "")
    code = request.GET.get("code", "")
    state_ok = bool(pending and state and constant_time_compare(state, pending.get("state", "")))
    if state_ok and pending.get("purpose") == "drive":
        # Mode 3 : les erreurs reviennent sur la page GoogleSheet, pas sur la page de connexion
        next_url = pending.get("next") or "/sheet"
        if not drive.is_configured():
            return redirect(with_param(next_url, "google_error", "google_drive_not_configured"))
        if request.GET.get("error") or not code:
            return redirect(with_param(next_url, "google_error", "google_denied"))
        return _drive_callback(request, pending, code)
    if not google.is_configured():
        return _fail("google_not_configured")
    if request.GET.get("error"):
        return _fail("google_denied")
    if not state_ok or not code:
        return _fail("google_state_invalid")
    try:
        claims = google.exchange_code(code, pending.get("code_verifier", ""))
    except google.GoogleAuthError as exc:
        return _fail(exc.code)

    user, created = user_for_google(claims)
    if not user.is_active:  # compte désactivé dans l'admin
        return _fail("account_disabled")
    login(request, user, backend="django.contrib.auth.backends.ModelBackend")  # nouvelle clé de session
    if created:
        request.session["first_login"] = True  # le site recopie alors une seule fois ses réglages du navigateur
    return redirect(pending.get("next") or "/")


@require_GET
def drive_start(request):
    """Mode 3 : demande à Google l'accès aux feuilles que la personne choisira (scope drive.file)."""
    next_url = safe_next(request.GET.get("next") or "/sheet")
    if not request.user.is_authenticated:
        return redirect(f"{LOGIN_PAGE}?next={quote(next_url)}")
    if not drive.is_configured():
        return redirect(with_param(next_url, "google_error", "google_drive_not_configured"))
    account = getattr(request.user, "google_account", None)
    if account is None:  # compte Django sans Google (administrateur) : pas de mode 3
        return redirect(with_param(next_url, "google_error", "google_requires_account"))
    url, state, code_verifier = google.authorization_url(
        google.LOGIN_SCOPES + [drive.DRIVE_SCOPE], offline=True, login_hint=account.email
    )
    request.session[SESSION_KEY] = {
        "state": state,
        "code_verifier": code_verifier,
        "next": next_url,
        "purpose": "drive",
        "user_id": request.user.pk,
    }
    return redirect(url)


def _drive_callback(request, pending, code):
    """Retour de Google après l'autorisation du mode 3 : jeton de rafraîchissement chiffré en base."""
    next_url = pending.get("next") or "/sheet"

    def fail(error_code):
        return redirect(with_param(next_url, "google_error", error_code))

    user = request.user
    account = getattr(user, "google_account", None) if user.is_authenticated else None
    if account is None or user.pk != pending.get("user_id"):
        return fail("google_state_invalid")  # session changée entre le départ et le retour
    try:
        claims, tokens = google.exchange(code, pending.get("code_verifier", ""), google.LOGIN_SCOPES + [drive.DRIVE_SCOPE])
    except google.GoogleAuthError as exc:
        return fail(exc.code)
    if claims["sub"] != account.sub:
        return fail("google_account_mismatch")  # autre compte Google choisi chez Google
    if drive.DRIVE_SCOPE not in google.granted_scopes(tokens):
        return fail("google_drive_denied")  # case « fichiers choisis » décochée chez Google
    refresh_token = tokens.get("refresh_token")
    if not refresh_token:
        return fail("google_token_failed")
    try:
        drive.store_refresh_token(account, refresh_token)
    except drive.DriveError as exc:
        return fail(exc.code)
    return redirect(with_param(next_url, "google", "connected"))


def _no_store(response):
    response["Cache-Control"] = "no-store"
    return response


@api_view(["GET"])
def picker_token(request):
    if not request.user.is_authenticated:
        return error_response("Connecte-toi d'abord.", "login_required", 401)
    try:
        return _no_store(JsonResponse(drive.picker_token(request.user)))
    except drive.DriveError as exc:
        return error_response(str(exc), exc.code, exc.status)


@api_view(["POST"])
def drive_revoke(request):
    if not request.user.is_authenticated:
        return error_response("Connecte-toi d'abord.", "login_required", 401)
    drive.revoke(request.user)
    return JsonResponse({"authorized": False})


def _user_view(user):
    account = getattr(user, "google_account", None)
    return {
        "email": account.email if account else user.email,
        "name": (account.name if account else "") or user.get_full_name(),
        "picture": account.picture if account else "",
    }


@api_view(["GET"])
def me(request):
    get_token(request)  # cookie csrftoken : le site le renvoie dans l'en-tête X-CSRFToken
    user = request.user
    body = {"configured": google.is_configured(), "authenticated": bool(user and user.is_authenticated)}
    if body["authenticated"]:
        body["user"] = _user_view(user)
        body["first_login"] = bool(request.session.pop("first_login", False))
    return JsonResponse(body)


@api_view(["POST"])
def logout_view(request):
    logout(request)  # vide la session
    get_token(request)
    return JsonResponse({"configured": google.is_configured(), "authenticated": False})
