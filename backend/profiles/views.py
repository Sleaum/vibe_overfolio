import re

from django.http import JsonResponse
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny

from fx.rates import ISO_CODES
from googlesheet.errors import error_response

from .models import Profile

# Au plus 200 types d'actifs, nom de 100 caractères au plus, couleur au format #rrggbb
MAX_ASSET_COLORS = 200
MAX_NAME_LENGTH = 100
COLOR = re.compile(r"^#[0-9a-f]{6}$")


def current_profile(request):
    """
    Profil de la personne qui appelle l'API.

    Compte connecté (session) : son profil (créé au premier appel s'il manque). Sinon, le profil du site
    (sans utilisateur), celui des visiteurs non connectés.
    """
    user = getattr(request, "user", None)
    if user is not None and user.is_authenticated:
        profile, _ = Profile.objects.get_or_create(user=user)
        return profile
    return Profile.site_profile()


def _serialize(profile):
    return {
        "asset_colors": profile.asset_colors or {},
        "theme": profile.theme,
        "chart_currencies": profile.chart_currencies or [],
        "display_currency": profile.display_currency or "",
        "volatility_months": profile.volatility_months or [],
        "updated_at": profile.updated_at.isoformat() if profile.updated_at else None,
    }


def _clean_asset_colors(value):
    """Couleurs reçues -> {type en minuscules: '#rrggbb'}, ou None si elles ne sont pas valables."""
    if not isinstance(value, dict) or len(value) > MAX_ASSET_COLORS:
        return None
    cleaned = {}
    for name, color in value.items():
        key = str(name).strip().lower()
        if not key or len(key) > MAX_NAME_LENGTH or not isinstance(color, str):
            return None
        color = color.strip().lower()
        if not COLOR.match(color):
            return None
        cleaned[key] = color
    return cleaned


THEMES = {"", "light", "dark"}
MAX_WINDOWS = 12  # périodes de Volatility
MAX_MONTHS = 240  # 20 ans


def _clean_months(value):
    """Périodes de Volatility -> nombres de mois (1 à 240) sans doublon, triés ; None si non valables."""
    if not isinstance(value, list) or len(value) > MAX_WINDOWS:
        return None
    months = set()
    for item in value:
        if isinstance(item, bool) or not isinstance(item, int) or not 1 <= item <= MAX_MONTHS:
            return None
        months.add(item)
    return sorted(months)
CURRENCY_CODE = re.compile(r"^[A-Z]{3}$")
MAX_CURRENCIES = 40


def _clean_currencies(value):
    """Devises reçues -> liste de codes ISO (« EUR »…), sans doublon, dans l'ordre ; None si non valable."""
    if not isinstance(value, list) or len(value) > MAX_CURRENCIES:
        return None
    codes = []
    for code in value:
        if not isinstance(code, str) or not CURRENCY_CODE.match(code.strip().upper()):
            return None
        code = code.strip().upper()
        if code not in codes:
            codes.append(code)
    return codes


@api_view(["GET", "PUT"])
@permission_classes([AllowAny])
def profile_detail(request):
    """
    GET /api/profile/ : réglages gardés en base (profil du compte connecté, sinon profil du site).
    PUT /api/profile/ : enregistre ce qui est envoyé, le reste ne change pas :
      {"theme": "dark"}                   mode ("light", "dark", ou "" pour suivre le système) ;
      {"chart_currencies": ["EUR", "THB"]} devises de « Patrimoine par devise » ([] = toutes) ;
      {"display_currency": "THB"}         devise des pages Charts et Simulation ("" = euro) ;
      {"volatility_months": [1, 3, 6]}    périodes de Volatility, en mois ([] = 1, 3 et 12).
    Avec une session ouverte, le jeton CSRF est exigé (en-tête X-CSRFToken).
    """
    profile = current_profile(request)
    if request.method == "PUT":
        body = request.data if isinstance(request.data, dict) else {}
        fields = []
        if "theme" in body or not body.keys() & {"chart_currencies", "display_currency", "volatility_months"}:
            theme = body.get("theme")
            if theme not in THEMES:
                return error_response("Mode d'affichage non valable", "invalid_theme", 400)
            profile.theme = theme
            fields.append("theme")
        if "chart_currencies" in body:
            currencies = _clean_currencies(body.get("chart_currencies"))
            if currencies is None:
                return error_response("Devises non valables", "invalid_currencies", 400)
            profile.chart_currencies = currencies
            fields.append("chart_currencies")
        if "display_currency" in body:
            code = body.get("display_currency")
            code = code.strip().upper() if isinstance(code, str) else None
            if code is None or (code and code not in ISO_CODES):
                return error_response("Devise non valable", "invalid_currency", 400)
            profile.display_currency = code
            fields.append("display_currency")
        if "volatility_months" in body:
            months = _clean_months(body.get("volatility_months"))
            if months is None:
                return error_response("Périodes non valables", "invalid_volatility_months", 400)
            profile.volatility_months = months
            fields.append("volatility_months")
        profile.save(update_fields=[*fields, "updated_at"])
    return JsonResponse(_serialize(profile))


@api_view(["PUT"])
@permission_classes([AllowAny])
def profile_asset_colors(request):
    """PUT /api/profile/asset-colors/ {"asset_colors": {type: couleur}} : remplace les couleurs choisies ({} = par défaut)."""
    body = request.data if isinstance(request.data, dict) else None
    colors = _clean_asset_colors(body.get("asset_colors")) if body is not None else None
    if colors is None:
        return error_response("Couleurs des actifs non valables", "invalid_asset_colors", 400)
    profile = current_profile(request)
    profile.asset_colors = colors
    profile.save(update_fields=["asset_colors", "updated_at"])
    return JsonResponse(_serialize(profile))
