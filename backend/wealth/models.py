from django.conf import settings
from django.db import models


class PortfolioDay(models.Model):
    """
    Total de la table portfolio, gardé une fois par jour (le dernier de la journée) à chaque synchronisation :
    sert à la variation « 24h » de la page Snapshot (wealth/daily.py). history n'a qu'un relevé par mois.

    Montants dans la devise de la feuille (`currency`), convertis à la lecture. `source` : document d'où vient
    portfolio ; un relevé d'un autre document n'est jamais comparé. Une ligne par propriétaire et par jour.
    """

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.CASCADE, related_name="portfolio_days"
    )
    day = models.DateField()  # jour de la synchronisation (fuseau du serveur)
    assets = models.FloatField(default=0)  # somme des Assets Master Currency positifs
    liabilities = models.FloatField(default=0)  # somme des Liabilities Master Currency négatifs (≤ 0)
    currency = models.CharField(max_length=3, default="EUR")
    source = models.CharField(max_length=200, blank=True, default="")
    recorded_at = models.DateTimeField(auto_now=True)

    class Meta:
        # Table créée par googlesheet avant que le modèle n'arrive ici : son nom est gardé (migration 0001).
        db_table = "googlesheet_portfolioday"
        ordering = ["day"]
        constraints = [
            models.UniqueConstraint(fields=["user", "day"], name="uniq_portfolioday_user_day"),
            models.UniqueConstraint(
                fields=["day"], condition=models.Q(user__isnull=True), name="uniq_portfolioday_site_day"
            ),
        ]

    def __str__(self):
        return f"portfolio {self.day}" + ("" if self.user_id is None else f" ({self.user})")
