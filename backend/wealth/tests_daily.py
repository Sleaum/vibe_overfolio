import datetime
from decimal import Decimal
from unittest import mock

from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.test import TestCase
from django.utils import timezone

from fx.ecb import Update
from fx.models import ExchangeRate

from googlesheet.models import SheetTable

from .daily import record_portfolio_day
from .models import PortfolioDay
from .tests_currencies import ENV, read_tab

NOV_20 = datetime.date(2026, 11, 20)


@mock.patch.dict("os.environ", ENV, clear=False)
class PortfolioDayTests(TestCase):
    """Total de portfolio gardé chaque jour : variation « 24h » de Snapshot (daily.py)."""

    def setUp(self):
        cache.clear()
        for code, rate in (("USD", "1.16"), ("THB", "37.5")):
            ExchangeRate.objects.create(date=NOV_20, currency=code, rate=Decimal(rate))

    def sync(self):
        cache.clear()  # pas de délai entre deux synchronisations du test
        with mock.patch("googlesheet.sync.open_spreadsheet", return_value=object()), \
                mock.patch("googlesheet.sync.read_worksheet_values", side_effect=read_tab), \
                mock.patch("wealth.currencies.update_rates", return_value=Update(latest=NOV_20)):
            response = self.client.post("/api/data/sync/")
        self.assertEqual(response.status_code, 200, response.content)
        # Synchronisation du 21 novembre (la date du jour ne doit pas dépendre du jour où le test tourne)
        SheetTable.objects.filter(name="portfolio").update(
            synced_at=datetime.datetime(2026, 11, 21, 10, tzinfo=datetime.timezone.utc)
        )

    def previous(self, currency=""):
        query = f"?currency={currency}" if currency else ""
        return self.client.get(f"/api/data/portfolio/{query}").json()["previous_day"]

    def test_sync_keeps_todays_total(self):
        self.sync()
        record = PortfolioDay.objects.get(user=None, day=timezone.localdate())
        self.assertEqual((record.assets, record.liabilities, record.currency, record.source), (37500, 0, "THB", "id-site"))
        self.sync()  # deuxième synchronisation du jour : le relevé est remplacé, pas doublé
        self.assertEqual(PortfolioDay.objects.filter(user=None).count(), 1)

    def test_previous_day_in_display_currency(self):
        self.sync()
        PortfolioDay.objects.all().delete()
        self.assertIsNone(self.previous())  # premier jour : rien à comparer
        PortfolioDay.objects.create(day=NOV_20, assets=30000, liabilities=-3750, currency="THB", source="id-site")
        PortfolioDay.objects.create(day=NOV_20 - datetime.timedelta(days=1), assets=1, currency="THB", source="id-site")
        self.assertEqual(self.previous(), {"date": "2026-11-20", "assets": 800, "liabilities": -100})
        self.assertEqual(self.previous("THB"), {"date": "2026-11-20", "assets": 30000, "liabilities": -3750})
        self.assertEqual(self.previous("USD")["assets"], 928)

    def test_same_day_other_document_and_other_owner_are_ignored(self):
        self.sync()
        PortfolioDay.objects.all().delete()
        PortfolioDay.objects.create(day=datetime.date(2026, 11, 21), assets=5, currency="THB", source="id-site")  # même jour
        PortfolioDay.objects.create(day=NOV_20, assets=5, currency="THB", source="autre-feuille")
        alice = get_user_model().objects.create(username="alice")
        PortfolioDay.objects.create(user=alice, day=NOV_20, assets=5, currency="THB", source="id-site")
        self.assertIsNone(self.previous())

    def test_missing_rate_gives_no_change(self):
        self.sync()
        PortfolioDay.objects.create(day=NOV_20 - datetime.timedelta(days=30), assets=30000, currency="THB", source="id-site")
        self.assertIsNone(self.previous())  # pas de taux THB ce jour-là : pas de variation fausse
        self.assertEqual(self.previous("THB")["assets"], 30000)  # dans la devise de la feuille, aucun taux nécessaire

    def test_no_portfolio_table(self):
        self.assertIsNone(record_portfolio_day(None))
        history = SheetTable.objects.create(name="history", columns=["Date"])
        self.assertIsNone(self.client.get(f"/api/data/{history.name}/").json()["previous_day"])
