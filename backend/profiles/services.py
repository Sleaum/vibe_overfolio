from .models import Profile


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
