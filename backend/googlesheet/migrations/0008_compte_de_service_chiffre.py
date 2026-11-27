"""
Le compte de service Google n'est plus gardé en clair dans onze colonnes : un seul champ, `service_account`,
contient son JSON chiffré (core/crypto.py). Les configurations déjà enregistrées sont chiffrées au passage.

Retour en arrière (migrate googlesheet 0007) : les onze colonnes reviennent, remplies avec les valeurs déchiffrées.
Une valeur qu'aucune clé connue ne déchiffre (clé changée entre-temps) est laissée vide, avec un avertissement.
"""
import json
import logging

from django.db import migrations, models

from core import crypto

logger = logging.getLogger(__name__)

# Champs du fichier JSON de Google, figés à cette migration (même ordre que googlesheet/config.py)
CREDENTIAL_FIELDS = [
    "type",
    "project_id",
    "private_key_id",
    "private_key",
    "client_email",
    "client_id",
    "auth_uri",
    "token_uri",
    "auth_provider_x509_cert_url",
    "client_x509_cert_url",
    "universe_domain",
]


def encrypt_accounts(apps, schema_editor):
    SheetConfig = apps.get_model("googlesheet", "SheetConfig")
    for row in SheetConfig.objects.all():
        account = {field: getattr(row, field) or "" for field in CREDENTIAL_FIELDS}
        row.service_account = crypto.encrypt(json.dumps(account)) if any(account.values()) else ""
        row.save(update_fields=["service_account"])


def decrypt_accounts(apps, schema_editor):
    SheetConfig = apps.get_model("googlesheet", "SheetConfig")
    for row in SheetConfig.objects.exclude(service_account=""):
        try:
            account = json.loads(crypto.decrypt(row.service_account))
        except crypto.DecryptError:
            logger.warning("Configuration %s : compte de service illisible (clé changée), colonnes laissées vides", row.pk)
            continue
        for field in CREDENTIAL_FIELDS:
            setattr(row, field, account.get(field, ""))
        row.save(update_fields=CREDENTIAL_FIELDS)


class Migration(migrations.Migration):
    dependencies = [
        ("googlesheet", "0007_total_portfolio_par_jour"),
    ]

    operations = [
        migrations.AddField(
            model_name="sheetconfig",
            name="service_account",
            field=models.TextField(blank=True, default=""),
        ),
        migrations.RunPython(encrypt_accounts, decrypt_accounts),
        *[migrations.RemoveField(model_name="sheetconfig", name=field) for field in CREDENTIAL_FIELDS],
    ]
