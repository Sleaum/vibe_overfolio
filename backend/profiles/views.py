import re

from django.http import JsonResponse
from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.permissions import AllowAny

from googlesheet.errors import error_response

from .models import Profile

# Au plus 200 types d'actifs, nom de 100 caractères au plus, couleur au format #rrggbb
MAX_ASSET_COLORS = 200
MAX_NAME_LENGTH = 100
COLOR = re.compile(r"^#[0-9a-f]{6}$")


def current_profile(request):
    """
    Profil de la personne qui appelle l'API.

    Utilisateur connecté : son profil (créé au premier appel). Sinon, le profil du site (sans utilisateur),
    le seul tant que la connexion n'est pas branchée.
    """
    user = getattr(request, "user", None)
    if user is not None and user.is_authenticated:
        profile, _ = Profile.objects.get_or_create(user=user)
        return profile
    profile = Profile.objects.filter(user__isnull=True).order_by("pk").first()
    return profile or Profile.objects.create()


def _serialize(profile):
    return {
        "asset_colors": profile.asset_colors or {},
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


@api_view(["GET"])
@authentication_classes([])  # pas de session pour l'instant ; à retirer quand la connexion sera branchée
@permission_classes([AllowAny])
def profile_detail(request):
    """GET /api/profile/ : réglages gardés en base."""
    return JsonResponse(_serialize(current_profile(request)))


@api_view(["PUT"])
@authentication_classes([])  # pas de session : évite le rejet CSRF si l'admin est connecté
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
