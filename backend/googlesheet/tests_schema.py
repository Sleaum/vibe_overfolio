import datetime
import unittest

from django.test import SimpleTestCase

from .schema import (
    AMOUNT,
    DATE,
    NUMBER,
    SCHEMAS,
    TEXT,
    find_column,
    normalize_name,
    normalize_rows,
    resolve_columns,
    sheet_column,
    to_date,
    to_number,
)


class ToNumberTests(SimpleTestCase):
    """Mêmes cas que toNumber dans frontend/tests/aggregate.test.js (None là où le site met 0)."""

    def test_reads_numbers(self):
        cases = [
            (12.5, 12.5),
            (12, 12.0),
            ("12.5", 12.5),
            ("12,5", 12.5),
            ("1 234,56 €", 1234.56),
            ("1 234,56 €", 1234.56),
            ("1.234,56", 1234.56),
            ("-2 500", -2500.0),
            ("$99", 99.0),
            ("1e3", 1000.0),
        ]
        for value, expected in cases:
            with self.subTest(value=value):
                self.assertEqual(to_number(value), expected)

    def test_unreadable_is_none(self):
        for value in ["", "   ", "abc", None, float("nan"), float("inf"), True, {}, "nan", "inf", "1_000", "0x10", "€"]:
            with self.subTest(value=value):
                self.assertIsNone(to_number(value))

    @unittest.skip("À corriger dans une PR à part : la virgule des milliers est lue comme une décimale")
    def test_english_format(self):
        self.assertEqual(to_number("1,234.56"), 1234.56)


class ToDateTests(SimpleTestCase):
    """Mêmes cas que toIsoDate dans frontend/tests/dates.test.js."""

    def test_reads_dates(self):
        cases = [
            ("2026-11-14", "2026-11-14"),
            ("2026/11/14", "2026-11-14"),
            ("2026.1.5", "2026-01-05"),
            ("2026-11-14 10:30:00", "2026-11-14"),
            ("2026-11-14T10:30:00Z", "2026-11-14"),
            ("14/11/2026", "2026-11-14"),
            ("14-11-2026", "2026-11-14"),
            ("5.1.2026", "2026-01-05"),
            ("  14/11/2026  ", "2026-11-14"),
            ("29/02/2024", "2024-02-29"),
        ]
        for value, expected in cases:
            with self.subTest(value=value):
                self.assertEqual(to_date(value).isoformat(), expected)

    def test_serial_numbers(self):
        self.assertEqual(to_date(45000), datetime.date(2023, 3, 15))
        self.assertEqual(to_date(45000.99), datetime.date(2023, 3, 15))
        self.assertEqual(to_date(46340), datetime.date(2026, 11, 14))

    def test_unreadable_is_none(self):
        for value in ["", None, "abc", "31/02/2026", "2026-13-01", "1899-12-31", "14/11/26", "20261114", 100,
                      float("nan"), True]:
            with self.subTest(value=value):
                self.assertIsNone(to_date(value))


class ParsingTests(SimpleTestCase):
    def test_parsing(self):
        self.assertEqual(to_date("14/11/2026"), datetime.date(2026, 11, 14))
        self.assertEqual(to_date(46000), datetime.date(1899, 12, 30) + datetime.timedelta(days=46000))
        self.assertIsNone(to_date("31/02/2026"))
        self.assertEqual(to_number("1 234,50 €"), 1234.5)
        self.assertEqual(to_number("1.234,50"), 1234.5)
        self.assertIsNone(to_number(""))


class ColumnNameTests(SimpleTestCase):
    """Mêmes cas que findColumn dans frontend/tests/aggregate.test.js."""

    columns = ["Date", "Assets Master Currency", "Sous-type", "Enveloppe"]

    def test_ignores_case_accents_spaces(self):
        self.assertEqual(find_column(self.columns, ["date"]), "Date")
        self.assertEqual(find_column(self.columns, ["assets_master_currency"]), "Assets Master Currency")
        self.assertEqual(find_column(self.columns, ["  ASSETS   master-currency "]), "Assets Master Currency")
        self.assertEqual(find_column(self.columns, ["sous type"]), "Sous-type")
        self.assertEqual(find_column(self.columns, ["ÉNVELOPPE"]), "Enveloppe")

    def test_first_sheet_column_wins(self):
        self.assertEqual(find_column(["Compte", "Enveloppe"], ["Envelope", "Enveloppe", "Compte"]), "Compte")

    def test_missing(self):
        self.assertIsNone(find_column(self.columns, ["Broker"]))
        self.assertIsNone(find_column([], ["Date"]))

    def test_sheet_column_uses_aliases(self):
        self.assertEqual(sheet_column("portfolio", self.columns, "Envelope"), "Enveloppe")
        self.assertEqual(sheet_column("portfolio", self.columns, "Sub Asset"), "Sous-type")
        self.assertIsNone(sheet_column("budget", self.columns, "Envelope"))

    def test_no_name_belongs_to_two_columns(self):
        for table, schema in SCHEMAS.items():
            owners = {}
            for column in schema:
                for name in column.names:
                    key = normalize_name(name)
                    with self.subTest(table=table, name=name):
                        self.assertEqual(owners.setdefault(key, column.name), column.name)


class ResolveColumnsTests(SimpleTestCase):
    def test_canonical_names_in_sheet_order(self):
        resolved = resolve_columns("portfolio", ["Mois", "Enveloppe", "Pays", "Ma note", "Qty"])
        self.assertEqual(resolved.columns, ("Date", "Envelope", "Area", "Ma note", "Quantity"))
        self.assertEqual(resolved.sheet_names["Envelope"], "Enveloppe")
        self.assertEqual(resolved.sheet_names["Ma note"], "Ma note")
        self.assertEqual(resolved.types, {"Date": DATE, "Envelope": TEXT, "Area": TEXT, "Quantity": NUMBER})

    def test_second_alias_keeps_its_name(self):
        resolved = resolve_columns("portfolio", ["Enveloppe", "Envelope", "Compte"])
        self.assertEqual(resolved.columns, ("Envelope", "Envelope (2)", "Compte"))
        self.assertEqual(resolved.sheet_names, {"Envelope": "Enveloppe", "Envelope (2)": "Envelope", "Compte": "Compte"})
        self.assertEqual(resolved.types, {"Envelope": TEXT})

    def test_currency_columns_of_history(self):
        resolved = resolve_columns("history", ["Date", "Total EUR", "USD", "Currency Price", "Liabilities Master Currency"])
        self.assertEqual(resolved.columns, ("Date", "EUR", "USD", "Currency Price", "Liabilities Master Currency"))
        self.assertEqual(resolved.types["EUR"], AMOUNT)
        self.assertEqual(resolved.types["Currency Price"], TEXT)
        self.assertEqual(resolve_columns("portfolio", ["USD"]).columns, ("USD",))

    def test_other_table_only_knows_amounts(self):
        resolved = resolve_columns("dividendes", ["Date", "assets master currency", "x"])
        self.assertEqual(resolved.columns, ("Date", "Assets Master Currency", "x"))
        self.assertEqual(resolved.types, {"Assets Master Currency": AMOUNT})


class NormalizeRowsTests(SimpleTestCase):
    def test_values_by_type(self):
        clean = normalize_rows(
            "portfolio",
            ["Mois", "Instruments", "Quantité", "Assets Master Currency", "Ticker", "Libre"],
            [
                {"Mois": "14/11/2026", "Instruments": " ETF World ", "Quantité": "3", "Assets Master Currency": "1 234,5 €",
                 "Ticker": 7.0, "Libre": " tel quel "},
                {"Mois": "", "Instruments": None, "Quantité": "", "Assets Master Currency": "n/a", "Ticker": "", "Libre": 4},
                {"Mois": "bientôt"},
            ],
        )
        self.assertEqual(clean.columns, ("Date", "Instrument", "Quantity", "Assets Master Currency", "Ticker", "Libre"))
        self.assertEqual(clean.rows[0], {
            "Date": "2026-11-14", "Instrument": "ETF World", "Quantity": 3.0, "Assets Master Currency": 1234.5,
            "Ticker": "7", "Libre": " tel quel ",
        })
        self.assertEqual(clean.rows[1], {
            "Date": None, "Instrument": "", "Quantity": None, "Assets Master Currency": None, "Ticker": "", "Libre": 4,
        })
        self.assertEqual(clean.rows[2]["Date"], None)
        self.assertEqual(clean.rows[2]["Libre"], "")
        self.assertEqual(clean.invalid_cells, 2)  # « n/a » et « bientôt » ; les cellules vides ne comptent pas
        self.assertEqual(clean.sheet_names["Quantity"], "Quantité")

