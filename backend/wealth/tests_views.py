import datetime
from decimal import Decimal

from django.core.cache import cache
from django.test import TestCase

from fx.models import ExchangeRate
from googlesheet.models import SheetRow, SheetTable


class TableFormatTests(TestCase):
    """GET /api/data/<onglet>/?values=clean : lignes lues par googlesheet/schema.py ; raw et défaut inchangés."""

    def setUp(self):
        cache.clear()
        ExchangeRate.objects.create(date=datetime.date(2026, 11, 20), currency="USD", rate=Decimal("1.16"))
        history = SheetTable.objects.create(
            name="history",
            columns=["Mois", "Asset", "Enveloppe", "Quantité", "Assets Master Currency", "Remarque"],
            row_count=2,
        )
        SheetRow.objects.create(table=history, position=0, data={
            "Mois": "20/11/2026", "Asset": "crypto", "Enveloppe": " Wallet ", "Quantité": "0,5",
            "Assets Master Currency": "1 000 €", "Remarque": "à vérifier",
        }, computed={"fx": {"EUR": 1000, "USD": 1160}})
        SheetRow.objects.create(table=history, position=1, data={
            "Mois": "bientôt", "Asset": "fiat", "Enveloppe": "", "Quantité": "", "Assets Master Currency": "n/a",
            "Remarque": "",
        })

    def get(self, query=""):
        response = self.client.get(f"/api/data/history/{query}")
        self.assertEqual(response.status_code, 200, response.content)
        return response.json()

    def test_default_and_raw_are_the_same(self):
        default, raw = self.get(), self.get("?values=raw")
        self.assertEqual(default, raw)
        self.assertEqual(default["columns"][:3], ["Mois", "Asset", "Enveloppe"])
        self.assertEqual(default["rows"][0]["Assets Master Currency"], "1 000 €")
        self.assertNotIn("types", default)

    def test_clean(self):
        body = self.get("?values=clean")
        self.assertEqual(
            body["columns"],
            ["Date", "Asset", "Envelope", "Quantity", "Assets Master Currency", "Remarque", "EUR", "USD"],
        )
        first, second = body["rows"]
        self.assertEqual(first, {
            "Date": "2026-11-20", "Asset": "crypto", "Envelope": "Wallet", "Quantity": 0.5,
            "Assets Master Currency": 1000.0, "Remarque": "à vérifier", "EUR": 1000.0, "USD": 1160.0,
        })
        self.assertEqual((second["Date"], second["Assets Master Currency"], second["Quantity"]), (None, None, None))
        self.assertEqual(body["types"]["Envelope"], "text")
        self.assertEqual(body["types"]["USD"], "amount")
        self.assertNotIn("Remarque", body["types"])
        self.assertEqual(body["sheet_names"]["Envelope"], "Enveloppe")
        self.assertEqual(body["sheet_names"]["Date"], "Mois")
        self.assertEqual(body["invalid_cells"], 2)  # « bientôt » et « n/a »
        self.assertEqual(body["computed_columns"], ["EUR", "USD"])  # devises calculées : même nom, déjà canonique

    def test_clean_with_display_currency(self):
        row = self.get("?values=clean&currency=USD")["rows"][0]
        self.assertEqual(row["Assets Master Currency"], 1160.0)
        self.assertEqual(self.get("?values=clean&currency=USD")["display_currency"], "USD")

    def test_unknown_values(self):
        response = self.client.get("/api/data/history/?values=csv")
        self.assertEqual(response.status_code, 400)
        self.assertEqual((response.json()["code"], response.json()["params"]), ("invalid_values", {"values": "raw, clean"}))
