import datetime
import io
import zipfile
from decimal import Decimal
from unittest import mock

from django.core.cache import cache
from django.test import TestCase

from . import ecb
from .models import ExchangeRate
from .rates import RateBook

CSV = "Date,USD,JPY,CHF,THB,RUB,\n2026-11-20,1.1600,180.10,0.9400,37.500,N/A,\n2026-11-19,1.1500,179.00,0.9300,37.400,N/A,\n"
XML = b"""<?xml version="1.0" encoding="UTF-8"?>
<gesmes:Envelope xmlns:gesmes="http://www.gesmes.org/xml/2002-08-01" xmlns="http://www.ecb.int/vocabulary/2002-08-01/eurofxref">
  <gesmes:subject>Reference rates</gesmes:subject>
  <Cube>
    <Cube time="2026-11-23"><Cube currency="USD" rate="1.1700"/><Cube currency="THB" rate="37.600"/></Cube>
    <Cube time="2026-11-20"><Cube currency="USD" rate="1.1600"/></Cube>
  </Cube>
</gesmes:Envelope>"""


def zipped(text):
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w") as archive:
        archive.writestr("eurofxref-hist.csv", text)
    return buffer.getvalue()


def answer(content):
    response = mock.Mock()
    response.raise_for_status.return_value = None
    response.raw.read.return_value = content
    return response


class EcbTests(TestCase):
    def setUp(self):
        cache.clear()

    def test_parse_history_and_xml(self):
        rows = ecb.parse_history_zip(zipped(CSV))
        self.assertIn((datetime.date(2026, 11, 20), "THB", Decimal("37.500")), rows)
        self.assertFalse([row for row in rows if row[1] == "RUB"])  # N/A ignoré
        self.assertEqual(len(rows), 8)
        rows = ecb.parse_xml(XML)
        self.assertEqual(rows[0], (datetime.date(2026, 11, 23), "USD", Decimal("1.1700")))
        self.assertEqual(len(rows), 3)

    def test_first_update_downloads_history_then_recent_days(self):
        with mock.patch("fx.ecb.requests.get", return_value=answer(zipped(CSV))) as get:
            update = ecb.update_rates(today=datetime.date(2026, 11, 21))
        self.assertEqual(get.call_args.args[0], ecb.HISTORY_ZIP)
        self.assertEqual((update.added, update.latest, update.source), (8, datetime.date(2026, 11, 20), "history"))

        cache.clear()
        with mock.patch("fx.ecb.requests.get", return_value=answer(XML)) as get:
            update = ecb.update_rates(today=datetime.date(2026, 11, 23))
        self.assertEqual(get.call_args.args[0], ecb.LAST_90_DAYS)
        self.assertEqual((update.added, update.latest), (2, datetime.date(2026, 11, 23)))  # 20/11 déjà là
        self.assertEqual(ExchangeRate.objects.count(), 10)

    def test_up_to_date_or_checked_recently_does_not_download(self):
        ExchangeRate.objects.create(date=datetime.date(2026, 11, 23), currency="USD", rate=Decimal("1.17"))
        with mock.patch("fx.ecb.requests.get") as get:
            ecb.update_rates(today=datetime.date(2026, 11, 23))
            self.assertFalse(get.called)
        with mock.patch("fx.ecb.requests.get", return_value=answer(XML)) as get:
            ecb.update_rates(today=datetime.date(2026, 11, 24))
            ecb.update_rates(today=datetime.date(2026, 11, 24))
            self.assertEqual(get.call_count, 1)  # une vérification par heure au plus

    def test_errors_never_raise(self):
        with mock.patch("fx.ecb.requests.get", side_effect=OSError("réseau")):
            self.assertEqual(ecb.update_rates(force=True).error, "fx_unreachable")
        with mock.patch("fx.ecb.requests.get", return_value=answer(b"pas un zip")):
            self.assertEqual(ecb.update_rates(force=True).error, "fx_invalid")
        self.assertFalse(ExchangeRate.objects.exists())


class RateBookTests(TestCase):
    def test_rate_of_a_day(self):
        for day, rate in ((datetime.date(2026, 11, 20), "37.5"), (datetime.date(2026, 10, 1), "36.0")):
            ExchangeRate.objects.create(date=day, currency="THB", rate=Decimal(rate))
        book = RateBook()
        self.assertEqual(book.rate("EUR", datetime.date(2026, 11, 22)), 1.0)
        self.assertEqual(book.rate("THB", datetime.date(2026, 11, 20)), 37.5)
        self.assertEqual(book.rate("THB", datetime.date(2026, 11, 22)), 37.5)  # week-end : vendredi
        self.assertEqual(book.rate("THB", datetime.date(2026, 12, 15)), 37.5)  # après le dernier jour publié
        self.assertIsNone(book.rate("THB", datetime.date(2026, 9, 1)))  # avant le premier taux
        self.assertIsNone(book.rate("GBP", datetime.date(2026, 11, 20)))
        self.assertEqual(book.codes, ["EUR", "THB"])

    def test_gap_and_old_currencies(self):
        rows = [("2026-01-05", "ISK", "140"), ("2026-03-02", "ISK", "141"), ("2026-03-02", "USD", "1.1"), ("2021-12-01", "RUB", "84")]
        for day, code, rate in rows:
            ExchangeRate.objects.create(date=datetime.date.fromisoformat(day), currency=code, rate=Decimal(rate))
        book = RateBook()
        self.assertIsNone(book.rate("ISK", datetime.date(2026, 2, 1)))  # devise suspendue : plus de 7 jours sans taux
        self.assertEqual(book.rate("ISK", datetime.date(2026, 3, 20)), 141.0)  # encore cotée au dernier jour publié
        self.assertIsNone(book.rate("RUB", datetime.date(2026, 3, 2)))  # plus cotée
        self.assertEqual(book.codes, ["EUR", "USD", "ISK"])  # RUB : ancienne devise, écartée
