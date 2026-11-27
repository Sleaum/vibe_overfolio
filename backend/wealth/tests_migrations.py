import datetime

from django.contrib.auth import get_user_model
from django.db import connection
from django.db.migrations.executor import MigrationExecutor
from django.test import TransactionTestCase


class PortfolioDayMoveTests(TransactionTestCase):
    """googlesheet 0009 et wealth 0001 : PortfolioDay change d'app sans perdre une ligne, dans les deux sens."""

    before = [("googlesheet", "0008_compte_de_service_chiffre"), ("wealth", None)]
    after = [("googlesheet", "0009_portfolioday_vers_wealth"), ("wealth", "0001_initial")]

    def migrate(self, target):
        executor = MigrationExecutor(connection)
        executor.loader.build_graph()
        executor.migrate(target)
        nodes = [node for node in target if node[1] is not None] + [("contenttypes", "0002_remove_content_type_name")]
        return executor.loader.project_state(nodes).apps

    def tearDown(self):
        executor = MigrationExecutor(connection)
        executor.migrate(executor.loader.graph.leaf_nodes())

    def rows(self, apps, app_label):
        PortfolioDay = apps.get_model(app_label, "PortfolioDay")
        return sorted(
            (day.user_id or 0, day.day, day.assets, day.liabilities, day.currency, day.source)
            for day in PortfolioDay.objects.all()
        )

    def test_rows_and_content_type_follow_the_model(self):
        apps = self.migrate(self.before)
        User = apps.get_model(*get_user_model()._meta.label.split("."))
        ContentType = apps.get_model("contenttypes", "ContentType")
        PortfolioDay = apps.get_model("googlesheet", "PortfolioDay")
        alice = User.objects.create(username="alice")
        PortfolioDay.objects.create(day=datetime.date(2026, 11, 20), assets=1000, liabilities=-400, source="id-site")
        PortfolioDay.objects.create(user=alice, day=datetime.date(2026, 11, 21), assets=5, currency="THB")
        ContentType.objects.filter(model="portfolioday").delete()
        content_type = ContentType.objects.create(app_label="googlesheet", model="portfolioday")
        expected = self.rows(apps, "googlesheet")
        self.assertEqual(len(expected), 2)

        apps = self.migrate(self.after)
        self.assertEqual(self.rows(apps, "wealth"), expected)
        self.assertEqual(apps.get_model("contenttypes", "ContentType").objects.get(pk=content_type.pk).app_label, "wealth")
        self.assertEqual(apps.get_model("wealth", "PortfolioDay")._meta.db_table, "googlesheet_portfolioday")

        apps = self.migrate(self.before)
        self.assertEqual(self.rows(apps, "googlesheet"), expected)
        self.assertEqual(
            apps.get_model("contenttypes", "ContentType").objects.get(pk=content_type.pk).app_label, "googlesheet"
        )
