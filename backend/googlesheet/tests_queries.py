"""
La configuration Google Sheet est lue une seule fois par requête (config.load_settings), puis passée telle quelle.
Avant : 3 à 5 lectures de googlesheet_sheetconfig par requête (une par appel à access_mode, sheet_id, doc_name…).
"""
import json
from unittest import mock

from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.db import connection
from django.test import TestCase
from django.test.utils import CaptureQueriesContext

from . import config
from .models import SheetConfig
from .tests import PUBLIC_ENV, fake_download, xlsx_bytes


def config_reads(queries):
    return sum(1 for q in queries if q["sql"].lstrip().upper().startswith("SELECT") and "googlesheet_sheetconfig" in q["sql"])


@mock.patch.dict("os.environ", PUBLIC_ENV, clear=False)
class OneConfigReadTests(TestCase):
    def setUp(self):
        cache.clear()
        # Taux BCE : rien à télécharger pendant ces tests (le nombre de requêtes ne dépend pas du réseau)
        patcher = mock.patch("wealth.currencies.update_rates", return_value=mock.Mock(latest=None, error=None))
        patcher.start()
        self.addCleanup(patcher.stop)

    def count(self, call):
        with CaptureQueriesContext(connection) as context:
            response = call()
        return response, context.captured_queries

    def test_load_settings_is_one_query_and_its_properties_none(self):
        with self.assertNumQueries(1):
            settings = config.load_settings()
            (settings.mode, settings.sheet_id, settings.doc_name, settings.tabs, settings.credentials, settings.source)

    def test_get_sheet_config(self):
        # Avant : 3 requêtes (saved_config, current_values, account_to_load)
        with self.assertNumQueries(1):
            self.assertEqual(self.client.get("/api/sheet-config/").json()["source"], "env")
        SheetConfig.objects.create(sheet_id="id-page", sync_tabs="portfolio")
        with self.assertNumQueries(1):
            self.assertEqual(self.client.get("/api/sheet-config/").json()["source"], "page")

    def test_sync(self):
        # Avant : 25 requêtes, dont 5 lectures de la configuration. Après : 1 lecture ; les 20 autres sont l'écriture
        # de l'onglet (table, lignes), le calcul des devises et le total du jour de portfolio.
        with fake_download(xlsx_bytes()), self.assertNumQueries(21):
            response = self.client.post("/api/data/sync/")
        self.assertEqual(response.status_code, 200, response.content)

    def test_every_route_reads_the_config_at_most_once(self):
        user = get_user_model().objects.create_user("alice")
        values = self.client.get("/api/sheet-config/").json()["values"]
        routes = [
            ("GET tabs", lambda: self.client.get("/api/sheet-config/tabs/")),
            ("POST sync d'un onglet", lambda: self.client.post("/api/data/portfolio/sync/")),
            ("GET data", lambda: self.client.get("/api/data/")),
            ("PUT config", lambda: self.client.put("/api/sheet-config/", json.dumps(values), content_type="application/json")),
            ("PUT tabs", lambda: self.client.put("/api/sheet-config/tabs/", json.dumps({"sync_tabs": "portfolio"}), content_type="application/json")),
            ("DELETE config", lambda: self.client.delete("/api/sheet-config/")),
        ]
        with fake_download(xlsx_bytes()):
            for name, call in routes:
                response, queries = self.count(call)
                self.assertLess(response.status_code, 300, name)
                self.assertLessEqual(config_reads(queries), 1, name)
            self.client.force_login(user)
            response, queries = self.count(lambda: self.client.get("/api/sheet-config/"))
        self.assertEqual(response.json()["scope"], "account")
        self.assertEqual(config_reads(queries), 1)
