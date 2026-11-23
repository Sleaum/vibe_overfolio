"""
L'onglet d'historique s'appelle désormais « history » (et non plus « _history ») :
- les tables déjà en base sont renommées, pour le site et pour chaque compte (sauf si une table « history » existe déjà) ;
- les listes d'onglets à synchroniser enregistrées sur la page GoogleSheet suivent.
"""
from django.db import migrations

OLD, NEW = "_history", "history"


def rename(apps, schema_editor, old=OLD, new=NEW):
    SheetTable = apps.get_model("googlesheet", "SheetTable")
    SheetConfig = apps.get_model("googlesheet", "SheetConfig")
    for table in SheetTable.objects.filter(name=old):
        if not SheetTable.objects.filter(user_id=table.user_id, name=new).exists():
            table.name = new
            table.save(update_fields=["name"])
    for config in SheetConfig.objects.all():
        tabs = [name.strip() for name in (config.sync_tabs or "").split(",") if name.strip()]
        if old in tabs:
            renamed = []
            for name in tabs:
                name = new if name == old else name
                if name not in renamed:
                    renamed.append(name)
            config.sync_tabs = ",".join(renamed)
            config.save(update_fields=["sync_tabs"])


def rename_back(apps, schema_editor):
    rename(apps, schema_editor, old=NEW, new=OLD)


class Migration(migrations.Migration):
    dependencies = [
        ("googlesheet", "0004_par_proprietaire"),
    ]

    operations = [
        migrations.RunPython(rename, rename_back),
    ]
