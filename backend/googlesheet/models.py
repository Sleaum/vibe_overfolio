from django.conf import settings
from django.db import models
from django.db.models.functions import Coalesce


class SheetTable(models.Model):
    """
    Un onglet du Google Sheet recopié en base (une ligne par onglet et par propriétaire).

    `user` vide : données du site (visiteurs non connectés) ; sinon données d'un compte connecté,
    que lui seul voit. Le nom d'onglet est unique par propriétaire.
    """

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.CASCADE, related_name="sheet_tables"
    )
    name = models.CharField(max_length=100)  # nom de l'onglet
    # Ordre des colonnes : PostgreSQL (jsonb) ne conserve pas l'ordre des clés d'un objet.
    columns = models.JSONField(default=list)
    header_row = models.PositiveIntegerField(default=1)  # ligne d'en-tête dans la feuille
    row_count = models.PositiveIntegerField(default=0)
    synced_at = models.DateTimeField(null=True, blank=True)
    # Document Google Sheets d'où vient la table (identifiant, ou « nom:<nom> ») ; vide = inconnu (avant ce champ).
    # Une synchronisation retire les tables d'un autre document : elles ne correspondent plus à la feuille configurée.
    source = models.CharField(max_length=200, blank=True, default="")
    # Devise des montants (Assets / Liabilities Master Currency) : lue au-dessus de l'en-tête (case M1 de portfolio),
    # EUR par défaut. Si ce n'est pas l'euro, les montants sont convertis en euros (googlesheet/currencies.py).
    currency = models.CharField(max_length=3, default="EUR")
    # Dernier calcul des devises (taux BCE) pour cette table
    rates_applied_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["user", "name"], name="uniq_sheettable_user_name"),
            # Données du site : NULL n'étant égal à rien, l'unicité du nom se déclare à part
            models.UniqueConstraint(
                fields=["name"], condition=models.Q(user__isnull=True), name="uniq_sheettable_site_name"
            ),
        ]

    def __str__(self):
        return self.name if self.user_id is None else f"{self.name} ({self.user})"


class SheetRow(models.Model):
    """Une ligne de données d'un onglet : {nom de colonne: valeur}."""

    table = models.ForeignKey(SheetTable, on_delete=models.CASCADE, related_name="rows")
    position = models.PositiveIntegerField()  # ordre de la ligne dans l'onglet (à partir de 0)
    data = models.JSONField()
    # Calculé par le site avec les taux BCE (googlesheet/currencies.py), à part des valeurs de la feuille :
    # {"fx": {"EUR": 1000.0, "USD": 1160.0, …}, "eur": {"Assets Master Currency": 1000.0, …}}
    computed = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ["position"]
        constraints = [
            models.UniqueConstraint(fields=["table", "position"], name="uniq_sheetrow_table_position"),
        ]

    def __str__(self):
        return f"{self.table_id}#{self.position}"


class SheetConfig(models.Model):
    """
    Paramètres d'accès au Google Sheet, saisis sur la page GoogleSheet : une ligne par propriétaire.

    `user` vide : configuration du site (visiteurs non connectés) ; tant qu'elle n'existe pas, les valeurs
    du .env s'appliquent. Sinon : configuration d'un compte connecté, sans repli sur le .env
    (voir googlesheet/config.py).
    """

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.CASCADE, related_name="sheet_config"
    )
    # "" : mode déduit des valeurs (lien public ou compte de service) ; "google" : compte Google de la personne
    method = models.CharField(max_length=20, blank=True, default="")

    # Compte de service Google (champs du fichier JSON téléchargé depuis Google Cloud)
    type = models.CharField(max_length=50, blank=True, default="service_account")
    project_id = models.CharField(max_length=200, blank=True, default="")
    private_key_id = models.CharField(max_length=200, blank=True, default="")
    private_key = models.TextField(blank=True, default="")
    client_email = models.CharField(max_length=320, blank=True, default="")
    client_id = models.CharField(max_length=200, blank=True, default="")
    auth_uri = models.CharField(max_length=500, blank=True, default="")
    token_uri = models.CharField(max_length=500, blank=True, default="")
    auth_provider_x509_cert_url = models.CharField(max_length=500, blank=True, default="")
    client_x509_cert_url = models.CharField(max_length=500, blank=True, default="")
    universe_domain = models.CharField(max_length=200, blank=True, default="")

    # Document
    sheet_id = models.CharField(max_length=200, blank=True, default="")
    doc_name = models.CharField(max_length=200, blank=True, default="")
    sync_tabs = models.CharField(max_length=500, blank=True, default="")  # séparés par des virgules

    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "configuration Google Sheet"
        verbose_name_plural = "configuration Google Sheet"
        constraints = [
            # Une seule configuration par propriétaire, site compris (NULL ramené à 0 pour être comparé)
            models.UniqueConstraint(Coalesce("user", models.Value(0)), name="uniq_sheetconfig_owner"),
        ]

    def __str__(self):
        return "Configuration Google Sheet" + ("" if self.user_id is None else f" de {self.user}")
