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
        self.assertEqual(config.load_settings().credentials["private_key"], KEY)

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
        self.assertEqual(config.load_settings().tabs, ["budget", "inout"])
        self.assertEqual(config.load_settings().credentials["project_id"], "projet-page")
        # clé privée laissée vide : celle du .env est conservée
        self.assertEqual(config.load_settings().values["private_key"], KEY)
        self.assertNotIn("PRIVATE KEY", SheetConfig.objects.get().service_account)  # chiffrée en base
        self.assertNotIn("PRIVATE KEY", response.content.decode())

    def test_new_private_key_is_saved(self):
        other = "-----BEGIN PRIVATE KEY-----\nXYZ\n-----END PRIVATE KEY-----"
        self.assertEqual(self.put(self.form(private_key=other)).status_code, 200)
        self.assertEqual(config.load_settings().credentials["private_key"], other + "\n")

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
        self.assertEqual(config.load_settings().credentials["project_id"], "projet-env")

    def test_sync_uses_saved_tabs(self):
        self.put(self.form(sync_tabs="budget"))
        self.assertEqual(self.client.post("/api/data/portfolio/sync/").status_code, 404)

    def test_client_is_rebuilt_when_credentials_change(self):
        with mock.patch.object(services.gspread, "service_account_from_dict", side_effect=lambda c: object()) as make:
            services._client = None
            first = services.get_client(config.load_settings())
            self.assertIs(services.get_client(config.load_settings()), first)
            self.put(self.form(project_id="projet-page"))
            self.assertIsNot(services.get_client(config.load_settings()), first)
            self.assertEqual(make.call_count, 2)
            self.assertEqual(make.call_args[0][0]["project_id"], "projet-page")
        services._client = None


@mock.patch.dict("os.environ", ENV, clear=False)
class SyncAllTests(TestCase):
    url = "/api/data/sync/"

    def setUp(self):
        from django.core.cache import cache

        cache.clear()

    def fake_sync(self, *results):
        return mock.patch("googlesheet.data_views.sync_sheets", return_value=list(results))

    def test_all_tabs_are_synced(self):
        from .sync import TabResult

        with self.fake_sync(
            TabResult(tab="portfolio", ok=True, saved=True, rows=41),
            TabResult(tab="stock", ok=True, saved=True, rows=12),
        ) as sync:
            response = self.client.post(self.url)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(sync.call_args.kwargs.get("tabs"), None)  # pas de filtre : toute la liste
        body = response.json()
        self.assertEqual((body["saved"], body["failed"]), (2, 0))
        self.assertEqual([t["name"] for t in body["tabs"]], ["portfolio", "stock"])

    def test_partial_failure_is_reported(self):
        from .sync import TabResult

        with self.fake_sync(
            TabResult(tab="portfolio", ok=True, saved=True, rows=41),
            TabResult(tab="stock", message="onglet introuvable"),
        ):
            body = self.client.post(self.url).json()
        self.assertEqual((body["saved"], body["failed"]), (1, 1))
        self.assertEqual(body["tabs"][1]["message"], "onglet introuvable")

    def test_total_failure_returns_502_and_releases_lock(self):
        from .sync import TabResult

        with self.fake_sync(TabResult(tab="portfolio", message="boom")):
            self.assertEqual(self.client.post(self.url).status_code, 502)
            self.assertEqual(self.client.post(self.url).status_code, 502)  # pas de 429 : le verrou est libéré

    def test_second_click_is_throttled(self):
        from .sync import TabResult

        with self.fake_sync(TabResult(tab="portfolio", ok=True, saved=True, rows=1)):
            self.assertEqual(self.client.post(self.url).status_code, 200)
            self.assertEqual(self.client.post(self.url).status_code, 429)

    def test_get_is_refused(self):
        self.assertEqual(self.client.get(self.url).status_code, 405)


# ---------- Lecture par lien public (solution 1) ----------

PUBLIC_ENV = {**ENV, "PROJECT_ID": "", "PRIVATE_KEY": "", "CLIENT_EMAIL": "", "GOOGLE_SHEET_ID": "id-public"}


def xlsx_bytes():
    """Fichier Excel comme celui qu'exporte Google : une ligne de synthèse au-dessus de l'en-tête."""
    import datetime
    import io

    import openpyxl

    book = openpyxl.Workbook()
    sheet = book.active
    sheet.title = "portfolio"
    sheet.append(["Total", 1234.5, None, None])
    sheet.append(["Date", "Asset", "Instrument", "Assets Master Currency"])
    sheet.append([datetime.datetime(2026, 11, 14), "public equity", "MSCI World", 52000.0])
    sheet.append([datetime.datetime(2026, 11, 14), "fiat", "Livret", 1234.56])
    book.create_sheet("budget").append(["Source", "Destination", "Valeur"])
    buffer = io.BytesIO()
    book.save(buffer)
    return buffer.getvalue()


def fake_download(content, status=200):
    response = mock.Mock(status_code=status)
    response.raw.read.return_value = content
    return mock.patch("googlesheet.services.requests.get", return_value=response)


@mock.patch.dict("os.environ", PUBLIC_ENV, clear=False)
class PublicLinkTests(TestCase):
    def setUp(self):
        from django.core.cache import cache

        cache.clear()

    def test_mode_depends_on_service_account(self):
        self.assertEqual(config.load_settings().mode, "public_link")
        with mock.patch.dict("os.environ", ENV):
            self.assertEqual(config.load_settings().mode, "service_account")
        with mock.patch.dict("os.environ", {"GOOGLE_SHEET_ID": ""}):
            self.assertEqual(config.load_settings().mode, "none")
        self.assertEqual(self.client.get("/api/sheet-config/").json()["mode"], "public_link")

    def test_public_sheet_is_read_like_the_api(self):
        from .models import SheetTable
        from .sync import sync_sheets

        with fake_download(xlsx_bytes()) as get:
            results = sync_sheets(config.load_settings(), tabs=["portfolio", "absent"])
        self.assertIn("id-public/export?format=xlsx", get.call_args[0][0])
        self.assertEqual([r.ok for r in results], [True, False])
        self.assertEqual(results[1].code, "tab_not_found")
        table = SheetTable.objects.get(name="portfolio")
        self.assertEqual(table.header_row, 2)  # ligne de synthèse ignorée
        rows = list(table.rows.order_by("position").values_list("data", flat=True))
        self.assertEqual(rows[0], {"Date": "2026-11-14", "Asset": "public equity", "Instrument": "MSCI World", "Assets Master Currency": 52000})
        self.assertEqual(rows[1]["Assets Master Currency"], 1234.56)

    def test_private_sheet_gives_a_clear_error(self):
        with fake_download(b"<!DOCTYPE html><html>connexion</html>"):
            response = self.client.post("/api/data/sync/")
        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json()["code"], "sheet_not_public")

    def test_tabs_are_listed(self):
        with fake_download(xlsx_bytes()):
            body = self.client.get("/api/sheet-config/tabs/").json()
        self.assertEqual(body["tabs"], ["portfolio", "budget"])
        self.assertEqual(body["mode"], "public_link")

    def test_link_alone_can_be_saved(self):
        response = self.client.put(
            "/api/sheet-config/",
            json.dumps({"sheet_id": "https://docs.google.com/spreadsheets/d/xyz/edit?usp=sharing", "sync_tabs": "portfolio"}),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(response.json()["mode"], "public_link")
        self.assertEqual(config.load_settings().sheet_id, "xyz")

    def test_link_is_required_without_service_account(self):
        response = self.client.put("/api/sheet-config/", json.dumps({"sheet_id": "", "doc_name": "overfolio", "sync_tabs": "portfolio"}), content_type="application/json")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["field_codes"], {"sheet_id": "sheet_link_required"})


@mock.patch.dict("os.environ", ENV, clear=False)
class ClearCredentialsTests(TestCase):
    def test_service_account_can_be_removed(self):
        values = self.client.get("/api/sheet-config/").json()["values"]
        self.assertEqual(self.client.get("/api/sheet-config/").json()["mode"], "service_account")
        response = self.client.put("/api/sheet-config/", json.dumps({**values, "clear_credentials": True}), content_type="application/json")
        self.assertEqual(response.status_code, 200, response.content)
        body = response.json()
        self.assertEqual(body["mode"], "public_link")
        self.assertFalse(body["private_key_set"])
        self.assertEqual(config.load_settings().values["private_key"], "")


@mock.patch.dict("os.environ", ENV, clear=False)
class AccountToLoadTests(TestCase):
    """Mode 2 choisi sur la page : le compte de service proposé vient de la base, sinon du .env."""

    def test_env_account_is_offered_after_switching_to_public_link(self):
        values = self.client.get("/api/sheet-config/").json()["values"]
        body = self.client.put("/api/sheet-config/", json.dumps({**values, "clear_credentials": True}), content_type="application/json").json()
        self.assertEqual(body["mode"], "public_link")
        self.assertEqual(body["account"]["source"], "env")
        self.assertEqual(body["account"]["values"]["client_email"], ENV["CLIENT_EMAIL"])
        self.assertTrue(body["account"]["private_key_set"])
        self.assertNotIn("private_key", body["account"]["values"])
        # Retour au mode 2 avec le compte du .env, clé laissée vide : la clé du .env est reprise
        again = {**body["values"], **body["account"]["values"], "private_key": ""}
        response = self.client.put("/api/sheet-config/", json.dumps(again), content_type="application/json")
        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(response.json()["mode"], "service_account")
        self.assertIn("PRIVATE KEY", config.load_settings().values["private_key"])

    def test_saved_account_is_offered_first(self):
        values = self.client.get("/api/sheet-config/").json()["values"]
        mine = {**values, "client_email": "autre@projet.iam.gserviceaccount.com", "project_id": "autre"}
        body = self.client.put("/api/sheet-config/", json.dumps(mine), content_type="application/json").json()
        self.assertEqual(body["account"]["source"], "page")
        self.assertEqual(body["account"]["values"]["client_email"], "autre@projet.iam.gserviceaccount.com")

    def test_env_key_is_not_given_to_another_account(self):
        values = self.client.get("/api/sheet-config/").json()["values"]
        self.client.put("/api/sheet-config/", json.dumps({**values, "clear_credentials": True}), content_type="application/json")
        other = {**values, "client_email": "autre@projet.iam.gserviceaccount.com", "private_key": ""}
        response = self.client.put("/api/sheet-config/", json.dumps(other), content_type="application/json")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["field_codes"].get("private_key"), "required")


@mock.patch.dict("os.environ", PUBLIC_ENV, clear=False)
class OtherDocumentTests(TestCase):
    """Feuille changée sur la page : les tables de l'ancien document ne restent pas en base."""

    def setUp(self):
        from django.core.cache import cache

        from .models import SheetRow, SheetTable

        cache.clear()
        old = SheetTable.objects.create(name="ancien_onglet", source="id-ancien", columns=["A"], row_count=1)
        SheetRow.objects.create(table=old, position=0, data={"A": 1})
        SheetTable.objects.create(name="budget", source="id-ancien", columns=["A"], row_count=1)

    def test_tables_of_another_document_are_removed(self):
        from .models import SheetRow, SheetTable

        with fake_download(xlsx_bytes()):
            response = self.client.post("/api/data/sync/")
        body = response.json()
        self.assertEqual(response.status_code, 200, body)
        # « budget » est vide dans le nouveau document : ses données venaient de l'ancien, retirées aussi
        self.assertEqual(body["removed"], ["ancien_onglet", "budget"])
        self.assertEqual(sorted(SheetTable.objects.values_list("name", flat=True)), ["portfolio"])
        self.assertEqual(set(SheetTable.objects.values_list("source", flat=True)), {"id-public"})
        self.assertFalse(SheetRow.objects.filter(table__name="ancien_onglet").exists())

    def test_failed_tab_of_the_same_document_keeps_its_data(self):
        from .models import SheetTable

        SheetTable.objects.create(name="inout", source="id-public", columns=["A"], row_count=3)
        with fake_download(xlsx_bytes()):
            body = self.client.post("/api/data/sync/").json()
        self.assertNotIn("inout", body["removed"])  # absent de la feuille ce coup-ci, mais même document
        self.assertEqual(SheetTable.objects.get(name="inout").row_count, 3)

    def test_nothing_is_removed_if_the_document_cannot_be_opened(self):
        from .models import SheetTable

        with fake_download(b"<html>connexion</html>"):
            self.client.post("/api/data/sync/")
        self.assertEqual(SheetTable.objects.count(), 2)


@mock.patch.dict("os.environ", PUBLIC_ENV, clear=False)
class AtomicSaveTests(TestCase):
    """Une écriture qui échoue en cours de route ne laisse pas un onglet vidé ou à moitié remplacé."""

    def test_failed_write_keeps_previous_rows(self):
        import datetime

        from django.db import DatabaseError
        from django.utils import timezone

        from .models import SheetRow, SheetTable
        from .sync import sync_sheets

        synced_at = timezone.make_aware(datetime.datetime(2026, 1, 2, 3, 4, 5))
        # Trois lignes, quand la feuille simulée en a deux : un row_count remplacé se verrait
        old_rows = [{"Asset": f"ancien {i}"} for i in range(1, 4)]
        table = SheetTable.objects.create(
            name="portfolio", source="id-public", columns=["Asset"], row_count=3, synced_at=synced_at
        )
        SheetRow.objects.bulk_create([SheetRow(table=table, position=i, data=row) for i, row in enumerate(old_rows)])

        with fake_download(xlsx_bytes()), mock.patch.object(
            SheetRow.objects, "bulk_create", side_effect=DatabaseError("panne simulée")
        ), self.assertLogs("googlesheet.sync", level="ERROR"):
            results = sync_sheets(config.load_settings(), tabs=["portfolio"])

        self.assertEqual(results[0].code, "database_error")
        self.assertFalse(results[0].saved)
        table.refresh_from_db()
        self.assertEqual(table.row_count, 3)
        self.assertEqual(table.columns, ["Asset"])
        self.assertEqual(table.synced_at, synced_at)
        self.assertEqual(list(table.rows.values_list("data", flat=True)), old_rows)


@mock.patch.dict("os.environ", ENV, clear=False)
class SaveTabsTests(TestCase):
    url = "/api/sheet-config/tabs/"

    def put(self, data):
        return self.client.put(self.url, json.dumps(data), content_type="application/json")

    def test_tabs_alone_are_saved_and_access_is_unchanged(self):
        response = self.put({"sync_tabs": " portfolio ,budget,"})
        self.assertEqual(response.status_code, 200, response.content)
        body = response.json()
        self.assertEqual(body["values"]["sync_tabs"], "portfolio,budget")
        self.assertEqual(body["mode"], "service_account")  # .env repris tel quel, clé comprise
        self.assertTrue(body["private_key_set"])
        self.assertEqual(config.load_settings().tabs, ["portfolio", "budget"])

    def test_empty_list_is_refused(self):
        response = self.put({"sync_tabs": " , "})
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["field_codes"], {"sync_tabs": "sync_tabs_required"})
        self.assertFalse(SheetConfig.objects.exists())

    def test_connection_form_keeps_the_tabs(self):
        self.put({"sync_tabs": "budget"})
        values = dict(self.client.get("/api/sheet-config/").json()["values"])
        values.pop("sync_tabs")
        response = self.client.put("/api/sheet-config/", json.dumps(values), content_type="application/json")
        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(config.load_settings().tabs, ["budget"])
