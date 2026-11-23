from django.conf import settings
from django.db import models


class Profile(models.Model):
    """
    Réglages d'une personne, gardés en base (couleurs des types d'actifs…).

    Tant qu'il n'y a pas de comptes, un seul profil existe, sans utilisateur (`user` vide) : il vaut pour tout le site.
    Quand la connexion sera branchée (page /newpage, compte Google ou autre), chaque utilisateur aura le sien :
    voir `current_profile` dans views.py.
    """

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        related_name="profile",
    )
    # Couleur choisie par type d'actif : {"crypto": "#f9ab00", …} (type en minuscules)
    asset_colors = models.JSONField(default=dict, blank=True)
    # Mode clair ou sombre choisi avec le bouton de l'en-tête ; vide = suivre le réglage du système
    theme = models.CharField(max_length=10, blank=True, default="", choices=[("light", "clair"), ("dark", "sombre")])
    # Devises affichées dans « Patrimoine par devise » : ["EUR", "USD"…] ; vide = toutes celles disponibles
    chart_currencies = models.JSONField(default=list, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "profil"
        verbose_name_plural = "profils"

    @classmethod
    def site_profile(cls):
        """Profil du site (sans utilisateur) : celui des visiteurs non connectés."""
        return cls.objects.filter(user__isnull=True).order_by("pk").first() or cls.objects.create()

    @classmethod
    def copy_site_profile(cls, user):
        """Profil d'un nouveau compte : reprend une fois les réglages du profil du site."""
        site = cls.site_profile()
        profile, _ = cls.objects.update_or_create(
            user=user,
            defaults={
                "asset_colors": dict(site.asset_colors or {}),
                "theme": site.theme,
                "chart_currencies": list(site.chart_currencies or []),
            },
        )
        return profile

    def __str__(self):
        return f"Profil de {self.user}" if self.user_id else "Profil du site"
