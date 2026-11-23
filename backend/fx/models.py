from django.db import models


class ExchangeRate(models.Model):
    """
    Taux de référence de l'euro publié par la Banque centrale européenne : `rate` unités de `currency` pour 1 EUR,
    le jour `date` (jours ouvrés seulement). Données publiques, communes à tout le site.
    """

    date = models.DateField()
    currency = models.CharField(max_length=3)
    rate = models.DecimalField(max_digits=18, decimal_places=6)
    source = models.CharField(max_length=10, default="ECB")

    class Meta:
        verbose_name = "taux de change"
        verbose_name_plural = "taux de change"
        constraints = [models.UniqueConstraint(fields=["date", "currency"], name="uniq_exchangerate_date_currency")]
        indexes = [models.Index(fields=["currency", "date"], name="fx_rate_currency_date")]

    def __str__(self):
        return f"{self.date} 1 EUR = {self.rate} {self.currency}"
