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

from googlesheet.models import SheetRow, SheetTable

from .currencies import amount_columns, earliest_date

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
                mock.patch("wealth.currencies.update_rates", return_value=Update(latest=datetime.date(2026, 11, 20))):
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
        self.assertEqual(history["computed_columns"], ["THB", "EUR"])  # USD vient de la feuille ; EUR : devise d'affichage
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
                mock.patch("wealth.currencies.update_rates", return_value=Update(error="fx_unreachable")):
            body = self.client.post("/api/data/sync/").json()
        self.assertEqual(body["fx"]["error"], "fx_unreachable")
        self.assertEqual(body["saved"], 2)
        history = self.client.get("/api/data/history/").json()
        self.assertEqual(history["computed_columns"], ["EUR"])  # l'euro ne demande pas de taux
        # Sans taux THB, les montants de portfolio sont écartés (jamais des bahts présentés comme des euros)
        portfolio = self.client.get("/api/data/portfolio/").json()
        self.assertEqual(portfolio["rows"][0]["Assets Master Currency"], "")
        self.assertEqual(portfolio["unconverted_rows"], 1)  # signalé sur Snapshot et sur la page GoogleSheet
        # Dans sa propre devise, aucun taux n'est nécessaire
        portfolio = self.client.get("/api/data/portfolio/?currency=THB").json()
        self.assertEqual((portfolio["rows"][0]["Assets Master Currency"], portfolio["unconverted_rows"]), (37500, 0))

    def test_display_currency(self):
        self.sync()
        history = self.client.get("/api/data/history/?currency=thb").json()
        self.assertEqual(history["display_currency"], "THB")
        crypto, loan, cash, goal = history["rows"]
        self.assertEqual(crypto["Assets Master Currency"], 37500)  # 1000 € au taux du 20 novembre
        self.assertEqual(loan["Liabilities Master Currency"], -15000)
        self.assertEqual(cash["Assets Master Currency"], 18750)  # samedi : taux du vendredi
        self.assertEqual(crypto["THB"], 37500)  # colonne de la devise d'affichage, ajoutée même sans être cochée
        self.assertEqual(history["unconverted_rows"], 0)
        # Feuille en bahts, affichée en dollars : en passant par l'euro
        portfolio = self.client.get("/api/data/portfolio/?currency=USD").json()
        self.assertEqual(portfolio["rows"][0]["Assets Master Currency"], 1160)
        portfolio = self.client.get("/api/data/portfolio/?currency=THB").json()
        self.assertEqual(portfolio["rows"][0]["Assets Master Currency"], 37500)  # valeur de la feuille, sans arrondi
        # Devise inconnue
        response = self.client.get("/api/data/history/?currency=XYZ")
        self.assertEqual((response.status_code, response.json()["code"]), (400, "invalid_currency"))

    def test_other_tables(self):
        inout = SheetTable.objects.create(name="inout", columns=["date", "In", "Sortie", "Taxes", "Note"], row_count=1)
        SheetRow.objects.create(table=inout, position=0, data={"date": "2026-11-20", "In": 100, "Sortie": -40, "Taxes": "", "Note": 5})
        budget = SheetTable.objects.create(name="budget", columns=["Source", "Destination", "Valeur"], row_count=1)
        SheetRow.objects.create(table=budget, position=0, data={"Source": "Salaire", "Destination": "Loyer", "Valeur": "1 000,00"})
        row = self.client.get("/api/data/inout/?currency=USD").json()["rows"][0]
        self.assertEqual((row["In"], row["Sortie"], row["Taxes"], row["Note"]), (116, -46.4, "", 5))
        row = self.client.get("/api/data/budget/?currency=CHF").json()["rows"][0]
        self.assertEqual(row["Valeur"], 940)  # sans date : dernier taux connu

    def test_currencies_list(self):
        ExchangeRate.objects.create(date=datetime.date(2026, 11, 19), currency="GBP", rate=Decimal("0.87"))  # plus cotée le 20
        ExchangeRate.objects.create(date=datetime.date(2026, 11, 20), currency="RUB", rate=Decimal("90"))  # ancienne devise
        body = self.client.get("/api/fx/currencies/").json()
        self.assertEqual(body["date"], "2026-11-20")
        self.assertEqual(body["currencies"], [
            {"code": "EUR", "rate": 1.0}, {"code": "USD", "rate": 1.16}, {"code": "CHF", "rate": 0.94}, {"code": "THB", "rate": 37.5},
        ])
        ExchangeRate.objects.all().delete()
        self.assertEqual(self.client.get("/api/fx/currencies/").json(), {"date": None, "currencies": [{"code": "EUR", "rate": 1.0}]})


class CommandTests(TestCase):
    def test_recompute_every_owner(self):
        ExchangeRate.objects.create(date=datetime.date(2026, 11, 20), currency="USD", rate=Decimal("1.16"))
        alice = get_user_model().objects.create(username="alice")
        for owner in (None, alice):
            table = SheetTable.objects.create(user=owner, name="history", columns=["Date", "EUR"], row_count=1)
            SheetRow.objects.create(table=table, position=0, data={"Date": "2026-11-20", "EUR": 100})
        out = io.StringIO()
        update = Update(latest=datetime.date(2026, 11, 20))
        with mock.patch("wealth.management.commands.update_fx_rates.update_rates", return_value=update), \
                mock.patch("wealth.currencies.update_rates", return_value=update):
            call_command("update_fx_rates", "--recompute", stdout=out)
        self.assertIn("history : 1 lignes", out.getvalue())
        self.assertIn("history (alice) : 1 lignes", out.getvalue())
        for table in SheetTable.objects.all():
            self.assertEqual(table.rows.get().computed["fx"]["USD"], 116)


class HelpersTests(TestCase):
    def test_earliest_date(self):
        table = SheetTable.objects.create(name="history", columns=["Date", "EUR"], row_count=3)
        for position, day in enumerate(["2026-03-02", "02/01/2025", "pas une date"]):
            SheetRow.objects.create(table=table, position=position, data={"Date": day, "EUR": 1})
        self.assertEqual(earliest_date([table]), datetime.date(2025, 1, 2))
        self.assertIsNone(earliest_date([SheetTable.objects.create(name="vide", columns=["Asset"])]))


@mock.patch.dict("os.environ", ENV, clear=False)
class ProjectionTests(TestCase):
    """Mois prochain de history, tiré de portfolio (graphiques de Flow)."""

    def setUp(self):
        cache.clear()
        for day in (18, 20):
            ExchangeRate.objects.create(date=datetime.date(2026, 11, day), currency="THB", rate=Decimal("37.5"))
            ExchangeRate.objects.create(date=datetime.date(2026, 11, day), currency="USD", rate=Decimal("1.16"))
        self.history = SheetTable.objects.create(
            name="history", columns=["Date", "Asset", "Instrument", "Envelope", "Assets Master Currency", "Liabilities Master Currency", "EUR"]
        )
        SheetRow.objects.create(table=self.history, position=0, data={"Date": "2026-11-01", "Asset": "crypto", "Instrument": "BTC", "Assets Master Currency": 900})
        SheetRow.objects.create(table=self.history, position=1, data={"Date": "2039-01-01", "Assets Master Currency": 1000000})  # objectif
        self.portfolio = SheetTable.objects.create(
            name="portfolio", currency="THB",
            columns=["Date", "Asset", "Instrument", "Enveloppe", "Quantity", "Assets Master Currency", "Liabilities Master Currency"],
        )
        for position, data in enumerate([
            {"Date": "2026-11-20", "Asset": "crypto", "Instrument": "BTC", "Enveloppe": "Wallet", "Quantity": 0.1, "Assets Master Currency": 37500},
            {"Date": "2026-11-19", "Asset": "real estate", "Instrument": "Prêt", "Liabilities Master Currency": -7500},
            {"Date": "", "Asset": "", "Instrument": "", "Assets Master Currency": 99999},  # ligne de total : ignorée
        ]):
            SheetRow.objects.create(table=self.portfolio, position=position, data=data)

    def get(self, query="?projection=1"):
        return self.client.get(f"/api/data/history/{query}").json()

    def test_next_month_from_portfolio(self):
        body = self.get()
        self.assertEqual(body["projection"], {"date": "2026-12-01", "rows": 2, "unconverted": 0, "source_date": "2026-11-20"})
        self.assertEqual(body["row_count"], 0)  # rien n'est écrit en base (compteur de la synchronisation)
        btc, loan = body["rows"][-2:]
        self.assertEqual((btc["Date"], btc["Asset"], btc["Envelope"]), ("2026-12-01", "crypto", ""))  # Enveloppe ≠ Envelope
        self.assertEqual(btc["Assets Master Currency"], 1000)  # 37 500 THB au taux du 20 novembre
        self.assertEqual(loan["Liabilities Master Currency"], -200)
        self.assertEqual(btc["EUR"], 1000)  # colonne EUR de la feuille : remplie avec le montant calculé
        self.assertEqual(loan["EUR"], -200)
        self.assertNotIn("Quantity", btc)  # seulement les colonnes de history
        self.assertEqual(SheetRow.objects.filter(table=self.history).count(), 2)

    def test_display_currency_and_currency_chart(self):
        btc = self.get("?projection=1&currency=THB")["rows"][-2]
        self.assertEqual(btc["Assets Master Currency"], 37500)
        self.assertEqual(btc["USD"], 1160)  # colonne calculée de « Patrimoine par devise »

    def test_only_when_asked_and_month_not_recorded(self):
        self.assertIsNone(self.get("")["projection"])
        self.assertEqual(len(self.get("")["rows"]), 2)
        # Relevé de décembre encore dans la feuille : pas de doublon
        SheetRow.objects.create(table=self.history, position=2, data={"Date": "01/12/2026", "Asset": "crypto", "Instrument": "BTC", "Assets Master Currency": 950})
        body = self.get()
        self.assertIsNone(body["projection"])
        self.assertEqual(len(body["rows"]), 3)

    def test_without_portfolio_or_rate(self):
        ExchangeRate.objects.all().delete()
        body = self.get()
        self.assertEqual(body["projection"]["unconverted"], 2)  # bahts sans taux : montants écartés
        self.assertEqual(body["rows"][-2]["Assets Master Currency"], "")
        self.portfolio.delete()
        self.assertIsNone(self.get()["projection"])


class AmountColumnsTests(TestCase):
    def test_every_column_named_like_an_amount(self):
        self.assertEqual(amount_columns("inout", ["Date", "In", "Entree", "out", "Taxes"]), ["In", "Entree", "out", "Taxes"])
        self.assertEqual(amount_columns("history", ["Date", "EUR", "Assets Master Currency"]), ["Assets Master Currency"])
        self.assertEqual(amount_columns("dividendes", ["liabilities master currency", "Valeur"]), ["liabilities master currency"])
