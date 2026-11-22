from django.db import models


class SheetTable(models.Model):
    """Un onglet du Google Sheet recopié en base (une ligne par onglet)."""

    name = models.CharField(max_length=100, unique=True)  # nom de l'onglet
    # Ordre des colonnes : PostgreSQL (jsonb) ne conserve pas l'ordre des clés d'un objet.
    columns = models.JSONField(default=list)
    header_row = models.PositiveIntegerField(default=1)  # ligne d'en-tête dans la feuille
    row_count = models.PositiveIntegerField(default=0)
    synced_at = models.DateTimeField(null=True, blank=True)
    # Document Google Sheets d'où vient la table (identifiant, ou « nom:<nom> ») ; vide = inconnu (avant ce champ).
    # Une synchronisation retire les tables d'un autre document : elles ne correspondent plus à la feuille configurée.
    source = models.CharField(max_length=200, blank=True, default="")

    def __str__(self):
        return self.name


class SheetRow(models.Model):
    """Une ligne de données d'un onglet : {nom de colonne: valeur}."""

    table = models.ForeignKey(SheetTable, on_delete=models.CASCADE, related_name="rows")
    position = models.PositiveIntegerField()  # ordre de la ligne dans l'onglet (à partir de 0)
    data = models.JSONField()

    class Meta:
        ordering = ["position"]
        constraints = [
            models.UniqueConstraint(fields=["table", "position"], name="uniq_sheetrow_table_position"),
        ]

    def __str__(self):
        return f"{self.table_id}#{self.position}"


class SheetConfig(models.Model):
    """
    Paramètres d'accès au Google Sheet, saisis sur la page GoogleSheet (une seule ligne, pk=1).

    Tant que l'utilisateur n'a rien enregistré, cette ligne n'existe pas et les valeurs du .env
    s'appliquent (voir googlesheet/config.py).
    """

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

    def __str__(self):
        return "Configuration Google Sheet"
