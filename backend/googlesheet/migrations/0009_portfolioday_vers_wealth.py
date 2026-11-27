"""
PortfolioDay quitte googlesheet pour wealth (wealth 0001), sans toucher à sa table ni à ses lignes : seul l'état des
modèles de Django change.

Le type de contenu (django_content_type) suit le modèle, pour garder les droits d'administration déjà donnés sur
lui. Retour en arrière (migrate googlesheet 0008) : le modèle et son type de contenu reviennent à googlesheet.
"""
from django.db import migrations


def _move_content_type(apps, old, new):
    ContentType = apps.get_model("contenttypes", "ContentType")
    if not ContentType.objects.filter(app_label=new, model="portfolioday").exists():
        ContentType.objects.filter(app_label=old, model="portfolioday").update(app_label=new)


def to_wealth(apps, schema_editor):
    _move_content_type(apps, "googlesheet", "wealth")


def to_googlesheet(apps, schema_editor):
    _move_content_type(apps, "wealth", "googlesheet")


class Migration(migrations.Migration):

    dependencies = [
        ("googlesheet", "0008_compte_de_service_chiffre"),
        ("wealth", "0001_initial"),
        ("contenttypes", "0002_remove_content_type_name"),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            state_operations=[migrations.DeleteModel(name="PortfolioDay")],
            database_operations=[migrations.RunPython(to_wealth, to_googlesheet)],
        ),
    ]
