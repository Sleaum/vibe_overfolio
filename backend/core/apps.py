from django.apps import AppConfig


class CoreConfig(AppConfig):
    """Code partagé par les apps, sans modèle ; app Django pour sa commande rotate_encryption_key."""

    name = "core"
