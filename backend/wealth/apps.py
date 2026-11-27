from django.apps import AppConfig


class WealthConfig(AppConfig):
    """Calculs sur la copie de la feuille : devises (taux BCE), mois prochain, total du jour, lecture de /api/data/."""

    default_auto_field = "django.db.models.BigAutoField"
    name = "wealth"

    def ready(self):
        from googlesheet.signals import tables_synced

        from .signals import after_sync

        tables_synced.connect(after_sync, dispatch_uid="wealth.after_sync")
