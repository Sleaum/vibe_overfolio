import json
from unittest import mock

from django.test import TestCase

from . import config, services
from .models import SheetConfig

KEY = "-----BEGIN PRIVATE KEY-----\nABC\n-----END PRIVATE KEY-----\n"

ENV = {
    "TYPE": "service_account",
    "PROJECT_ID": "projet-env",
    "PRIVATE_KEY": KEY.replace("\n", "\\n"),
    "CLIENT_EMAIL": "env@projet.iam.gserviceaccount.com",
    "GOOGLE_SHEET_ID": "id-env",
    "SHEET_SYNC_TABS": "portfolio,stock",
}


@mock.patch.dict("os.environ", ENV, clear=False)
class SheetConfigTests(TestCase):
    url = "/api/sheet-config/"

    def put(self, data):
        return self.client.put(self.url, json.dumps(data), content_type="application/json")

    def form(self, **changes):
        values = dict(self.client.get(self.url).json()["values"])
        values.update(changes)
        return values

    def test_defaults_come_from_env_and_key_is_never_sent(self):
        body = self.client.get(self.url).json()
        self.assertEqual(body["source"], "env")
        self.assertEqual(body["values"]["project_id"], "projet-env")
        self.assertEqual(body["values"]["sheet_id"], "id-env")
        self.assertEqual(body["values"]["doc_name"], "overfolio")
        self.assertTrue(body["private_key_set"])
        self.assertNotIn("private_key", body["values"])
        self.assertNotIn("PRIVATE KEY", json.dumps(body))
        self.assertEqual(config.credentials()["private_key"], KEY)

    def test_saved_values_replace_env(self):
        response = self.put(
            self.form(
                project_id="projet-page",
                sheet_id="https://docs.google.com/spreadsheets/d/abc_123-XY/edit#gid=0",
                sync_tabs=" budget , inout ,",
            )
        )
        self.assertEqual(response.status_code, 200, response.content)
        body = response.json()
        self.assertEqual(body["source"], "page")
        self.assertEqual(body["values"]["sheet_id"], "abc_123-XY")
        self.assertEqual(config.sync_tabs(), ["budget", "inout"])
        self.assertEqual(config.credentials()["project_id"], "projet-page")
        # clé privée laissée vide : celle du .env est conservée
        self.assertEqual(SheetConfig.objects.get().private_key, KEY)
        self.assertNotIn("PRIVATE KEY", response.content.decode())

    def test_new_private_key_is_saved(self):
        other = "-----BEGIN PRIVATE KEY-----\nXYZ\n-----END PRIVATE KEY-----"
        self.assertEqual(self.put(self.form(private_key=other)).status_code, 200)
        self.assertEqual(config.credentials()["private_key"], other + "\n")

    def test_invalid_form_is_rejected(self):
        response = self.put(self.form(client_email="", sheet_id="", doc_name="", sync_tabs=" , "))
        self.assertEqual(response.status_code, 400)
        fields = response.json()["fields"]
        self.assertEqual(set(fields), {"client_email", "sheet_id", "sync_tabs"})
        self.assertFalse(SheetConfig.objects.exists())

    def test_reset_goes_back_to_env(self):
        self.put(self.form(project_id="projet-page"))
        body = self.client.delete(self.url).json()
        self.assertEqual(body["source"], "env")
        self.assertEqual(config.credentials()["project_id"], "projet-env")

    def test_sync_uses_saved_tabs(self):
        self.put(self.form(sync_tabs="budget"))
        self.assertEqual(self.client.post("/api/data/portfolio/sync/").status_code, 404)

    def test_client_is_rebuilt_when_credentials_change(self):
        with mock.patch.object(services.gspread, "service_account_from_dict", side_effect=lambda c: object()) as make:
            services._client = None
            first = services.get_client()
            self.assertIs(services.get_client(), first)
            self.put(self.form(project_id="projet-page"))
            self.assertIsNot(services.get_client(), first)
            self.assertEqual(make.call_count, 2)
            self.assertEqual(make.call_args[0][0]["project_id"], "projet-page")
        services._client = None
