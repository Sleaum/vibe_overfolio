from django.contrib.auth import get_user_model
from django.db import connection
from django.db.migrations.executor import MigrationExecutor
from django.test import TransactionTestCase


class HistoryRenameMigrationTests(TransactionTestCase):
    """Migration 0005 : « _history » devient « history » (tables en base et listes d'onglets enregistrées)."""

    before = [("googlesheet", "0004_par_proprietaire")]
    after = [("googlesheet", "0005_onglet_history")]

    def migrate(self, target):
        executor = MigrationExecutor(connection)
        executor.loader.build_graph()
        executor.migrate(target)
        return executor.loader.project_state(target).apps

    def test_tables_and_sync_lists_are_renamed(self):
        apps = self.migrate(self.before)
        SheetTable = apps.get_model("googlesheet", "SheetTable")
        SheetConfig = apps.get_model("googlesheet", "SheetConfig")
        User = apps.get_model(*get_user_model()._meta.label.split("."))
        alice = User.objects.create(username="alice")
        bob = User.objects.create(username="bob")
        SheetTable.objects.create(name="_history", columns=[])  # site
        SheetTable.objects.create(user=alice, name="_history", columns=[])
        SheetTable.objects.create(user=bob, name="_history", columns=[])
        SheetTable.objects.create(user=bob, name="history", columns=[])  # déjà là : on n'écrase pas
        SheetConfig.objects.create(sync_tabs="portfolio,_history,inout")
        SheetConfig.objects.create(user=alice, sync_tabs="_history,history")

        apps = self.migrate(self.after)
        SheetTable = apps.get_model("googlesheet", "SheetTable")
        SheetConfig = apps.get_model("googlesheet", "SheetConfig")
        names = sorted((t.user_id or 0, t.name) for t in SheetTable.objects.all())
        self.assertEqual(names, sorted([(0, "history"), (alice.pk, "history"), (bob.pk, "_history"), (bob.pk, "history")]))
        self.assertEqual(SheetConfig.objects.get(user=None).sync_tabs, "portfolio,history,inout")
        self.assertEqual(SheetConfig.objects.get(user=alice.pk).sync_tabs, "history")
