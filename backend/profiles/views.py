import re

from django.http import JsonResponse
from rest_framework.decorators import api_view

from fx.rates import ISO_CODES
from core.errors import error_response

from .services import current_profile

# Au plus 200 types d'actifs, nom de 100 caractères au plus, couleur au format #rrggbb
MAX_ASSET_COLORS = 200
MAX_NAME_LENGTH = 100
COLOR = re.compile(r"^#[0-9a-f]{6}$")


def _serialize(profile):
    return {
        "asset_colors": profile.asset_colors or {},
        "theme": profile.theme,
        "chart_currencies": profile.chart_currencies or [],
        "display_currency": profile.display_currency or "",
        "volatility_months": profile.volatility_months or [],
        "performance_days": profile.performance_days or [],
        "model_target": profile.model_target or {},
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
# Périodes : (champ, plus grande valeur, nombre au plus, code d'erreur)
WINDOWS = {
    "volatility_months": (240, 12, "invalid_volatility_months"),  # Volatility, en mois (20 ans)
    "performance_days": (3650, 8, "invalid_performance_days"),  # Snapshot, en jours (10 ans)
}


def _clean_windows(value, max_value, max_count):
    """Périodes -> entiers de 1 à max_value sans doublon, triés ; None si non valables."""
    if not isinstance(value, list) or len(value) > max_count:
        return None
    numbers = set()
    for item in value:
        if isinstance(item, bool) or not isinstance(item, int) or not 1 <= item <= max_value:
            return None
        numbers.add(item)
    return sorted(numbers)
# Cible de Models > Target : années possibles, nombre de lignes au plus par répartition
TARGET_YEARS = (2000, 2200)
TARGET_BASES = {"types", "classes"}
MAX_TARGET_ITEMS = 60


def _number(value, low, high):
    return not isinstance(value, bool) and isinstance(value, (int, float)) and low <= value <= high


def _clean_shares(value):
    """{nom: pourcentage de 0 à 100} -> même chose, nom nettoyé ; None si non valable."""
    if not isinstance(value, dict) or len(value) > MAX_TARGET_ITEMS:
        return None
    cleaned = {}
    for name, share in value.items():
        key = str(name).strip()
        if not key or len(key) > MAX_NAME_LENGTH or not _number(share, 0, 100):
            return None
        cleaned[key] = round(float(share), 2)
    return cleaned


def _clean_target(value):
    """Cible reçue -> {year, basis, types, classes, monthly} ; {} pour l'effacer ; None si non valable."""
    if not isinstance(value, dict):
        return None
    if not value:
        return {}
    year, basis, monthly = value.get("year"), value.get("basis"), value.get("monthly")
    types, classes = _clean_shares(value.get("types", {})), _clean_shares(value.get("classes", {}))
    if not (isinstance(year, int) and _number(year, *TARGET_YEARS)) or basis not in TARGET_BASES:
        return None
    if types is None or classes is None or not (monthly is None or _number(monthly, 0, 1e9)):
        return None
    return {"year": year, "basis": basis, "types": types, "classes": classes, "monthly": monthly}


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
def profile_detail(request):
    """
    GET /api/profile/ : réglages gardés en base (profil du compte connecté, sinon profil du site).
    PUT /api/profile/ : enregistre ce qui est envoyé, le reste ne change pas :
      {"asset_colors": {"crypto": "#f9ab00"}} couleurs des types d'actifs (remplacées en entier ; {} = par défaut) ;
      {"theme": "dark"}                   mode ("light", "dark", ou "" pour suivre le système) ;
      {"chart_currencies": ["EUR", "THB"]} devises de « Patrimoine par devise » ([] = toutes) ;
      {"display_currency": "THB"}         devise des pages Charts et Simulation ("" = euro) ;
      {"volatility_months": [1, 3, 6]}    périodes de Volatility, en mois ([] = 1, 3 et 12) ;
      {"performance_days": [30, 90]}      périodes de « Variation des prix par sous-type » (Snapshot), en jours ;
      {"model_target": {…}}               cible de Models > Target (voir _clean_target ; {} = effacée).
    Avec une session ouverte, le jeton CSRF est exigé (en-tête X-CSRFToken).
    """
    profile = current_profile(request)
    if request.method == "PUT":
        body = request.data if isinstance(request.data, dict) else {}
        fields = []
        if "theme" in body or not body.keys() & {"asset_colors", "chart_currencies", "display_currency", "model_target", *WINDOWS}:
            theme = body.get("theme")
            if theme not in THEMES:
                return error_response("Mode d'affichage non valable", "invalid_theme", 400)
            profile.theme = theme
            fields.append("theme")
        if "asset_colors" in body:
            colors = _clean_asset_colors(body.get("asset_colors"))
            if colors is None:
                return error_response("Couleurs des actifs non valables", "invalid_asset_colors", 400)
            profile.asset_colors = colors
            fields.append("asset_colors")
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
        for field, (max_value, max_count, code) in WINDOWS.items():
            if field in body:
                numbers = _clean_windows(body.get(field), max_value, max_count)
                if numbers is None:
                    return error_response("Périodes non valables", code, 400)
                setattr(profile, field, numbers)
                fields.append(field)
        if "model_target" in body:
            target = _clean_target(body.get("model_target"))
            if target is None:
                return error_response("Cible non valable", "invalid_model_target", 400)
            profile.model_target = target
            fields.append("model_target")
        profile.save(update_fields=[*fields, "updated_at"])
    return JsonResponse(_serialize(profile))


@api_view(["PUT"])
def profile_asset_colors(request):
    """
    PUT /api/profile/asset-colors/ {"asset_colors": {type: couleur}} : remplace les couleurs choisies ({} = par défaut).
    Ancienne route : le site passe maintenant par PUT /api/profile/ {"asset_colors": …}, même effet. Gardée pour un
    onglet resté ouvert avec l'ancien site pendant un déploiement ; à retirer ensuite.
    """
    body = request.data if isinstance(request.data, dict) else None
    colors = _clean_asset_colors(body.get("asset_colors")) if body is not None else None
    if colors is None:
        return error_response("Couleurs des actifs non valables", "invalid_asset_colors", 400)
    profile = current_profile(request)
    profile.asset_colors = colors
    profile.save(update_fields=["asset_colors", "updated_at"])
    return JsonResponse(_serialize(profile))
