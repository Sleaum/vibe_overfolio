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
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "profil"
        verbose_name_plural = "profils"

    def __str__(self):
        return f"Profil de {self.user}" if self.user_id else "Profil du site"
