import datetime
import json
from decimal import Decimal
from unittest import mock

import io

from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.core.management import call_command
from django.test import TestCase

from fx.ecb import Update
from fx.models import ExchangeRate

from .currencies import detect_currency, earliest_date, to_date, to_number
from .models import SheetRow, SheetTable

ENV = {"GOOGLE_SHEET_ID": "id-site", "SHEET_SYNC_TABS": "history,portfolio"}
HEADER = ["Date", "Asset", "Instrument", "Assets Master Currency", "Liabilities Master Currency"]
SHEET = {
    "history": [
        HEADER,
        ["2026-11-20", "crypto", "BTC", 1000, ""],
        ["20/11/2026", "real estate", "Prêt", "", -400],
        ["2026-11-22", "fiat", "Livret", "500", ""],  # samedi : taux du vendredi
        ["2025-01-01", "", "", "", "", ],  # objectif sans montant : rien
    ],
    "portfolio": [
        ["", "", "", "", "", "THB"],  # case au-dessus des montants : devise de portfolio
        HEADER[:3] + ["Envelope", "Assets Master Currency", "Liabilities Master Currency"],
        ["2026-11-20", "crypto", "BTC", "Wallet", 37500, ""],
    ],
}


def read_tab(spreadsheet, tab):
    return SHEET[tab]


@mock.patch.dict("os.environ", ENV, clear=False)
class CurrencySyncTests(TestCase):
    def setUp(self):
        cache.clear()
        for code, rate in (("USD", "1.16"), ("CHF", "0.94"), ("THB", "37.5")):
            ExchangeRate.objects.create(date=datetime.date(2026, 11, 20), currency=code, rate=Decimal(rate))

    def sync(self):
        with mock.patch("googlesheet.sync.open_spreadsheet", return_value=object()), \
                mock.patch("googlesheet.sync.read_worksheet_values", side_effect=read_tab), \
                mock.patch("googlesheet.sync.update_rates", return_value=Update(latest=datetime.date(2026, 11, 20))):
            response = self.client.post("/api/data/sync/")
        self.assertEqual(response.status_code, 200, response.content)
        return response.json()

    def test_history_gets_currencies(self):
        body = self.sync()
        self.assertEqual(body["fx"]["rates_latest"], "2026-11-20")
        history = self.client.get("/api/data/history/").json()
        self.assertEqual(history["computed_columns"], ["EUR", "USD", "CHF", "THB"])
        self.assertEqual(history["currencies_available"], ["EUR", "USD", "CHF", "THB"])
        self.assertEqual(history["columns"][-4:], ["EUR", "USD", "CHF", "THB"])
        crypto, loan, cash, goal = history["rows"]
        self.assertEqual((crypto["EUR"], crypto["USD"], crypto["THB"]), (1000, 1160, 37500))
        self.assertEqual(loan["USD"], -464)  # dette : montant négatif
        self.assertEqual(cash["CHF"], 470)
        self.assertNotIn("USD", goal)
        # La feuille n'est pas modifiée
        self.assertEqual(SheetTable.objects.get(name="history").rows.first().data["Assets Master Currency"], 1000)

    def test_profile_choice_and_sheet_columns_win(self):
        self.client.put("/api/profile/", json.dumps({"chart_currencies": ["THB", "USD"]}), content_type="application/json")
        SHEET["history"][0] = HEADER + ["USD"]
        SHEET["history"][1] = SHEET["history"][1] + [999]
        try:
            self.sync()
            history = self.client.get("/api/data/history/").json()
        finally:
            SHEET["history"][0] = HEADER
            SHEET["history"][1] = SHEET["history"][1][:5]
        self.assertEqual(history["computed_columns"], ["THB"])  # USD vient de la feuille
        self.assertEqual(history["rows"][0]["USD"], 999)

    def test_portfolio_in_baht_is_converted_to_euros(self):
        self.sync()
        portfolio = self.client.get("/api/data/portfolio/").json()
        self.assertEqual(portfolio["currency"], "THB")
        self.assertEqual(portfolio["rows"][0]["Assets Master Currency"], 1000)
        self.assertEqual(portfolio["computed_columns"], [])
        self.assertEqual(portfolio["unconverted_rows"], 0)
        table = SheetTable.objects.get(name="portfolio")
        self.assertEqual(table.rows.first().data["Assets Master Currency"], 37500)  # valeur de la feuille gardée

    def test_ecb_down_does_not_block_sync(self):
        ExchangeRate.objects.all().delete()
        with mock.patch("googlesheet.sync.open_spreadsheet", return_value=object()), \
                mock.patch("googlesheet.sync.read_worksheet_values", side_effect=read_tab), \
                mock.patch("googlesheet.sync.update_rates", return_value=Update(error="fx_unreachable")):
            body = self.client.post("/api/data/sync/").json()
        self.assertEqual(body["fx"]["error"], "fx_unreachable")
        self.assertEqual(body["saved"], 2)
        history = self.client.get("/api/data/history/").json()
        self.assertEqual(history["computed_columns"], ["EUR"])  # l'euro ne demande pas de taux
        # Sans taux THB, portfolio garde ses montants d'origine (pas de conversion inventée)
        portfolio = self.client.get("/api/data/portfolio/").json()
        self.assertEqual(portfolio["rows"][0]["Assets Master Currency"], 37500)
        self.assertEqual(portfolio["unconverted_rows"], 1)  # signalé sur Snapshot et sur la page GoogleSheet


class CommandTests(TestCase):
    def test_recompute_every_owner(self):
        ExchangeRate.objects.create(date=datetime.date(2026, 11, 20), currency="USD", rate=Decimal("1.16"))
        alice = get_user_model().objects.create(username="alice")
        for owner in (None, alice):
            table = SheetTable.objects.create(user=owner, name="history", columns=["Date", "EUR"], row_count=1)
            SheetRow.objects.create(table=table, position=0, data={"Date": "2026-11-20", "EUR": 100})
        out = io.StringIO()
        update = Update(latest=datetime.date(2026, 11, 20))
        with mock.patch("fx.management.commands.update_fx_rates.update_rates", return_value=update), \
                mock.patch("googlesheet.sync.update_rates", return_value=update):
            call_command("update_fx_rates", "--recompute", stdout=out)
        self.assertIn("history : 1 lignes", out.getvalue())
        self.assertIn("history (alice) : 1 lignes", out.getvalue())
        for table in SheetTable.objects.all():
            self.assertEqual(table.rows.get().computed["fx"]["USD"], 116)


class HelpersTests(TestCase):
    def test_detect_currency(self):
        values = [["Total", "", "EUR", "", "", "THB"], ["Date", "Asset", "x", "y", "Envelope", "Assets Master Currency"]]
        self.assertEqual(detect_currency(values, 2, values[1]), "THB")  # la plus proche de la colonne des montants
        self.assertEqual(detect_currency([["Date", "Assets Master Currency"]], 1, ["Date", "Assets Master Currency"]), "EUR")
        self.assertEqual(detect_currency([["usd"], ["Date", "Assets Master Currency"]], 2, []), "USD")

    def test_parsing(self):
        self.assertEqual(to_date("14/11/2026"), datetime.date(2026, 11, 14))
        self.assertEqual(to_date(46000), datetime.date(1899, 12, 30) + datetime.timedelta(days=46000))
        self.assertIsNone(to_date("31/02/2026"))
        self.assertEqual(to_number("1 234,50 €"), 1234.5)
        self.assertEqual(to_number("1.234,50"), 1234.5)
        self.assertIsNone(to_number(""))

    def test_earliest_date(self):
        table = SheetTable.objects.create(name="history", columns=["Date", "EUR"], row_count=3)
        for position, day in enumerate(["2026-03-02", "02/01/2025", "pas une date"]):
            SheetRow.objects.create(table=table, position=position, data={"Date": day, "EUR": 1})
        self.assertEqual(earliest_date([table]), datetime.date(2025, 1, 2))
        self.assertIsNone(earliest_date([SheetTable.objects.create(name="vide", columns=["Asset"])]))
