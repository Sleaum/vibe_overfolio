"""
Connexion avec Google, par session Django.

  GET  /api/auth/google/start/?next=/page : part vers Google (state et PKCE gardés en session)
  GET  /api/auth/google/callback/         : retour de Google -> connexion, puis retour sur `next`
                                            (en cas d'échec : /newpage?error=<code>)
  GET  /api/auth/me/                      : état de la connexion ; pose aussi le cookie CSRF du site
  POST /api/auth/logout/                  : déconnexion (jeton CSRF exigé si une session est ouverte)
"""
from django.contrib.auth import login, logout
from django.http import JsonResponse
from django.middleware.csrf import get_token
from django.shortcuts import redirect
from django.utils.crypto import constant_time_compare
from django.views.decorators.http import require_GET
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny

from . import google
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
        or value.startswith("/api/")
        or any(ord(char) < 32 for char in value)
        or len(value) > 500
    ):
        return "/"
    return value


def _fail(code):
    return redirect(f"{LOGIN_PAGE}?error={code}")


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
    if not google.is_configured():
        return _fail("google_not_configured")
    if request.GET.get("error"):
        return _fail("google_denied")
    state = request.GET.get("state", "")
    code = request.GET.get("code", "")
    if not pending or not state or not code or not constant_time_compare(state, pending.get("state", "")):
        return _fail("google_state_invalid")
    try:
        claims = google.exchange_code(code, pending.get("code_verifier", ""))
    except google.GoogleAuthError as exc:
        return _fail(exc.code)

    user, created = user_for_google(claims)
    login(request, user, backend="django.contrib.auth.backends.ModelBackend")  # nouvelle clé de session
    if created:
        request.session["first_login"] = True  # le site recopie alors une seule fois ses réglages du navigateur
    return redirect(pending.get("next") or "/")


def _user_view(user):
    account = getattr(user, "google_account", None)
    return {
        "email": account.email if account else user.email,
        "name": (account.name if account else "") or user.get_full_name(),
        "picture": account.picture if account else "",
    }


@api_view(["GET"])
@permission_classes([AllowAny])
def me(request):
    get_token(request)  # cookie csrftoken : le site le renvoie dans l'en-tête X-CSRFToken
    user = request.user
    body = {"configured": google.is_configured(), "authenticated": bool(user and user.is_authenticated)}
    if body["authenticated"]:
        body["user"] = _user_view(user)
        body["first_login"] = bool(request.session.pop("first_login", False))
    return JsonResponse(body)


@api_view(["POST"])
@permission_classes([AllowAny])
def logout_view(request):
    logout(request)  # vide la session
    get_token(request)
    return JsonResponse({"configured": google.is_configured(), "authenticated": False})
