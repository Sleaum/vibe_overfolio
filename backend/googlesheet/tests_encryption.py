"""Compte de service chiffré en base (SheetConfig.service_account) : rien en clair, même réponse de l'API."""
import json
from unittest import mock

from django.contrib.auth import get_user_model
from django.db import connection
from django.db.migrations.executor import MigrationExecutor
from django.test import TestCase, TransactionTestCase, override_settings

from core import crypto

from . import config
from .models import SheetConfig
from .tests import ENV, KEY

VIEW_KEYS = {"scope", "source", "mode", "method", "google", "updated_at", "values", "private_key_set", "env", "account"}
VALUE_KEYS = {
    "type", "project_id", "private_key_id", "client_email", "client_id", "auth_uri", "token_uri",
    "auth_provider_x509_cert_url", "client_x509_cert_url", "universe_domain", "sheet_id", "doc_name", "sync_tabs",
}


@mock.patch.dict("os.environ", {**ENV, "FIELD_ENCRYPTION_KEY": ""}, clear=False)
class EncryptedServiceAccountTests(TestCase):
    url = "/api/sheet-config/"

    def save_page_account(self):
        values = {**self.client.get(self.url).json()["values"], "project_id": "projet-page", "client_email": "page@projet.iam"}
        response = self.client.put(self.url, json.dumps({**values, "private_key": KEY}), content_type="application/json")
        self.assertEqual(response.status_code, 200, response.content)
        return response.json()

    def test_nothing_of_the_service_account_is_stored_in_clear(self):
        self.save_page_account()
        row = SheetConfig.objects.get()
        for clear in ("PRIVATE KEY", "page@projet.iam", "projet-page", "service_account"):
            self.assertNotIn(clear, row.service_account)
        account = json.loads(crypto.decrypt(row.service_account))
        self.assertEqual(account["private_key"], KEY)
        self.assertEqual(account["client_email"], "page@projet.iam")
        self.assertEqual(set(account), set(config.CREDENTIAL_FIELDS))

    def test_api_answer_keeps_its_shape_and_never_sends_the_key(self):
        body = self.save_page_account()
        again = self.client.get(self.url)
        for answer in (body, again.json()):
            self.assertEqual(set(answer), VIEW_KEYS)
            self.assertEqual(set(answer["values"]), VALUE_KEYS)
            self.assertTrue(answer["private_key_set"])
            self.assertEqual(answer["mode"], "service_account")
            self.assertEqual(answer["values"]["client_email"], "page@projet.iam")
        self.assertNotIn("PRIVATE KEY", again.content.decode())

    def test_removed_service_account_keeps_no_key(self):
        self.save_page_account()
        values = self.client.get(self.url).json()["values"]
        self.client.put(self.url, json.dumps({**values, "clear_credentials": True}), content_type="application/json")
        # Seul « type » reste (sa valeur revient telle quelle dans GET /api/sheet-config/) ; ni clé ni identifiants
        account = json.loads(crypto.decrypt(SheetConfig.objects.get().service_account))
        self.assertEqual({field: value for field, value in account.items() if value}, {"type": "service_account"})
        self.assertEqual(config.load_settings().mode, "public_link")

    def test_empty_service_account_is_stored_empty(self):
        SheetConfig.objects.create(sheet_id="id-lien")
        config.save_tabs("portfolio")
        row = SheetConfig.objects.get()
        row.service_account = ""
        row.save()
        self.assertEqual(config.load_settings().values["type"], "")  # une ligne enregistrée garde ses champs vides
        self.assertEqual(config.load_settings().mode, "public_link")

    def test_unreadable_account_asks_for_it_again(self):
        self.save_page_account()
        with override_settings(SECRET_KEY="autre-cle"), self.assertLogs("googlesheet.config", level="WARNING"):
            response = self.client.get(self.url)
        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(set(body), VIEW_KEYS)
        self.assertFalse(body["private_key_set"])
        self.assertEqual(body["values"]["client_email"], "")
        self.assertEqual(body["values"]["type"], "service_account")  # comme un compte neuf
        self.assertEqual(body["mode"], "public_link")  # le lien enregistré reste utilisable
        # Le compte de service du .env reste proposé au site pour le mode 2
        self.assertEqual(body["account"]["source"], "env")

    def test_unreadable_account_can_be_entered_again(self):
        self.save_page_account()
        with override_settings(SECRET_KEY="autre-cle"), self.assertLogs("googlesheet.config", level="WARNING"):
            body = self.save_page_account()
        self.assertTrue(body["private_key_set"])
        with override_settings(SECRET_KEY="autre-cle"):
            self.assertEqual(config.load_settings().values["private_key"], KEY)


class ServiceAccountMigrationTests(TransactionTestCase):
    """Migration 0008 : onze colonnes en clair -> un JSON chiffré, et retour."""

    before = [("googlesheet", "0007_total_portfolio_par_jour")]
    after = [("googlesheet", "0008_compte_de_service_chiffre")]

    def migrate(self, target):
        executor = MigrationExecutor(connection)
        executor.loader.build_graph()
        executor.migrate(target)
        return executor.loader.project_state(target).apps

    def tearDown(self):
        executor = MigrationExecutor(connection)
        executor.loader.build_graph()
        executor.migrate(executor.loader.graph.leaf_nodes())

    def test_forward_and_back(self):
        apps = self.migrate(self.before)
        Old = apps.get_model("googlesheet", "SheetConfig")
        User = apps.get_model(*get_user_model()._meta.label.split("."))
        alice = User.objects.create(username="alice")
        site_account = {
            "type": "service_account", "project_id": "projet", "private_key_id": "id-cle", "private_key": KEY,
            "client_email": "sa@projet.iam", "client_id": "123", "auth_uri": "https://a", "token_uri": "https://t",
            "auth_provider_x509_cert_url": "https://p", "client_x509_cert_url": "https://c", "universe_domain": "googleapis.com",
        }
        Old.objects.create(sheet_id="id-site", sync_tabs="portfolio", **site_account)
        Old.objects.create(user=alice, method="google", sheet_id="id-alice", type="")  # sans compte de service

        self.migrate(self.after)
        site = SheetConfig.objects.get(user=None)
        self.assertNotIn("PRIVATE KEY", site.service_account)
        self.assertEqual(json.loads(crypto.decrypt(site.service_account)), site_account)
        self.assertEqual(SheetConfig.objects.get(user=alice.pk).service_account, "")
        settings = config.load_settings()
        self.assertEqual(settings.mode, "service_account")
        self.assertEqual(settings.credentials, site_account)
        self.assertEqual((settings.sheet_id, settings.tabs), ("id-site", ["portfolio"]))

        apps = self.migrate(self.before)
        Old = apps.get_model("googlesheet", "SheetConfig")
        restored = Old.objects.get(user=None)
        self.assertEqual({field: getattr(restored, field) for field in site_account}, site_account)
        self.assertEqual(Old.objects.get(user=alice.pk).private_key, "")
