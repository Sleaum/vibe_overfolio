from django.conf import settings
from django.db import models


class GoogleAccount(models.Model):
    """
    Compte Google rattaché à un utilisateur Django (connexion « Continuer avec Google »).

    L'utilisateur est retrouvé par `sub`, l'identifiant Google stable du compte, jamais par l'e-mail
    (une adresse peut changer ou être réattribuée). E-mail, nom et photo sont remis à jour à chaque connexion.
    """

    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="google_account")
    sub = models.CharField(max_length=255, unique=True)
    email = models.EmailField(max_length=320)
    name = models.CharField(max_length=255, blank=True, default="")
    picture = models.URLField(max_length=1000, blank=True, default="")
    # Mode 3 de la page GoogleSheet : jeton de rafraîchissement Google (scope drive.file), chiffré (accounts/drive.py).
    # Jamais renvoyé au navigateur ; vide = accès non accordé ou retiré.
    drive_refresh_token = models.TextField(blank=True, default="")
    drive_authorized_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "compte Google"
        verbose_name_plural = "comptes Google"

    def __str__(self):
        return self.email
