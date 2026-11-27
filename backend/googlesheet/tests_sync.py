"""
Réponses des routes de synchronisation et de configuration : codes HTTP, corps, verrou, contrôle de X-Sheet-Scope.
Les complètent SyncAllTests (tests.py) et ScopeHeaderTests (accounts/tests_drive.py).
"""
import json
from unittest import mock

from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.test import TestCase

from .services import SheetAPIError
from .sync import TabResult
from .tests import ENV

TOO_SOON = {
    "error": "Synchronisation déjà faite à l'instant, réessaie dans 10 secondes.",
    "code": "sync_too_soon",
    "params": {"seconds": 10},
}


def fake_sync(*results, error=None):
    if error is not None:
        return mock.patch("googlesheet.data_views.sync_sheets", side_effect=error)
    return mock.patch("googlesheet.data_views.sync_sheets", return_value=list(results))


@mock.patch.dict("os.environ", ENV, clear=False)
class TableSyncTests(TestCase):
    url = "/api/data/portfolio/sync/"

    def setUp(self):
        cache.clear()

    def test_tab_is_synced(self):
        with fake_sync(TabResult(tab="portfolio", ok=True, saved=True, rows=3, columns=["Date", "Asset"])) as sync:
            response = self.client.post(self.url)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"name": "portfolio", "row_count": 3, "columns": ["Date", "Asset"]})
        self.assertEqual(sync.call_args.kwargs["tabs"], ["portfolio"])
        self.assertIsNone(sync.call_args.args[0].owner)

    def test_tab_outside_the_list_is_refused(self):
        response = self.client.post("/api/data/inconnu/sync/")
        self.assertEqual(response.status_code, 404)
        self.assertEqual(
            response.json(),
            {"error": "Onglet 'inconnu' non synchronisable", "code": "tab_not_syncable", "params": {"name": "inconnu"}},
        )

    def test_second_click_is_throttled_with_the_same_body(self):
        with fake_sync(TabResult(tab="portfolio", ok=True, saved=True, rows=1)):
            self.assertEqual(self.client.post(self.url).status_code, 200)
            response = self.client.post(self.url)
        self.assertEqual(response.status_code, 429)
        self.assertEqual(response.json(), TOO_SOON)

    def test_each_tab_has_its_own_lock(self):
        with fake_sync(TabResult(tab="portfolio", ok=True, saved=True, rows=1)):
            self.assertEqual(self.client.post(self.url).status_code, 200)
            self.assertEqual(self.client.post("/api/data/sync/").status_code, 200)
        with fake_sync(TabResult(tab="stock", ok=True, saved=True, rows=1)):
            self.assertEqual(self.client.post("/api/data/stock/sync/").status_code, 200)

    def test_failed_tab_returns_502_and_releases_lock(self):
        failed = TabResult(tab="portfolio", message="onglet vide", code="empty_kept", params={"tab": "portfolio"})
        with fake_sync(failed):
            response = self.client.post(self.url)
            self.assertEqual(self.client.post(self.url).status_code, 502)  # pas de 429 : le verrou est libéré
        self.assertEqual(response.status_code, 502)
        self.assertEqual(response.json(), {"error": "onglet vide", "code": "empty_kept", "params": {"tab": "portfolio"}})

    def test_failed_tab_without_message_has_default_body(self):
        with fake_sync(TabResult(tab="portfolio")):
            response = self.client.post(self.url)
        self.assertEqual(response.json(), {"error": "Synchronisation impossible", "code": "sync_failed", "params": {}})

    def test_unreachable_document_returns_its_error_and_releases_lock(self):
        error = SheetAPIError("Google Sheets est injoignable : panne", "google_unreachable", detail="panne")
        with fake_sync(error=error):
            response = self.client.post(self.url)
            self.assertEqual(self.client.post(self.url).status_code, 502)
        self.assertEqual(response.status_code, 502)
        self.assertEqual(
            response.json(),
            {"error": "Google Sheets est injoignable : panne", "code": "google_unreachable", "params": {"detail": "panne"}},
        )


@mock.patch.dict("os.environ", ENV, clear=False)
class SyncAllErrorTests(TestCase):
    url = "/api/data/sync/"

    def setUp(self):
        cache.clear()

    def test_unreachable_document_returns_its_error_and_releases_lock(self):
        error = SheetAPIError("Erreur de l'API Google Sheets : quota", "google_api_error", detail="quota")
        with fake_sync(error=error):
            response = self.client.post(self.url)
            self.assertEqual(self.client.post(self.url).status_code, 502)
        self.assertEqual(
            response.json(),
            {"error": "Erreur de l'API Google Sheets : quota", "code": "google_api_error", "params": {"detail": "quota"}},
        )

    def test_no_tab_saved_lists_each_tab(self):
        with fake_sync(TabResult(tab="portfolio", message="boom", code="tab_not_found"), TabResult(tab="stock")):
            response = self.client.post(self.url)
        self.assertEqual(response.status_code, 502)
        body = response.json()
        self.assertEqual(body["error"], "Aucun onglet n'a pu être actualisé (portfolio : boom ; stock : erreur)")
        self.assertEqual(body["code"], "no_tab_saved")
        self.assertEqual(body["params"], {})
        self.assertEqual([tab["name"] for tab in body["tabs"]], ["portfolio", "stock"])
        self.assertEqual(body["tabs"][0]["code"], "tab_not_found")

    def test_success_body(self):
        with fake_sync(TabResult(tab="portfolio", ok=True, saved=True, rows=2)):
            body = self.client.post(self.url).json()
        self.assertEqual(
            body,
            {
                "tabs": [{"name": "portfolio", "ok": True, "row_count": 2, "message": "", "code": "", "params": {}}],
                "saved": 1,
                "failed": 0,
                "removed": [],
                "fx": {},
            },
        )

    def test_throttled_body(self):
        with fake_sync(TabResult(tab="portfolio", ok=True, saved=True, rows=1)):
            self.client.post(self.url)
            response = self.client.post(self.url)
        self.assertEqual((response.status_code, response.json()), (429, TOO_SOON))


@mock.patch.dict("os.environ", ENV, clear=False)
class ScopeOnEveryRouteTests(TestCase):
    """X-Sheet-Scope est contrôlé sur chaque requête qui modifie, et ignoré en lecture."""

    def setUp(self):
        cache.clear()
        self.user = get_user_model().objects.create_user("alice")

    def test_expired_session_is_refused_everywhere(self):
        for method, url in (
            ("post", "/api/data/portfolio/sync/"),
            ("post", "/api/data/sync/"),
            ("put", "/api/sheet-config/"),
            ("delete", "/api/sheet-config/"),
            ("put", "/api/sheet-config/tabs/"),
        ):
            with fake_sync() as sync:
                response = getattr(self.client, method)(url, "{}", content_type="application/json", HTTP_X_SHEET_SCOPE="account")
            self.assertEqual(response.status_code, 401, url)
            self.assertEqual(
                response.json(),
                {"error": "Ta session a expiré : recharge la page.", "code": "session_expired", "params": {}},
                url,
            )
            sync.assert_not_called()

    def test_sign_in_elsewhere_is_refused_everywhere(self):
        self.client.force_login(self.user)
        for method, url in (
            ("post", "/api/data/portfolio/sync/"),
            ("post", "/api/data/sync/"),
            ("put", "/api/sheet-config/"),
            ("delete", "/api/sheet-config/"),
            ("put", "/api/sheet-config/tabs/"),
        ):
            response = getattr(self.client, method)(url, "{}", content_type="application/json", HTTP_X_SHEET_SCOPE="site")
            self.assertEqual(response.status_code, 409, url)
            self.assertEqual(response.json()["code"], "scope_changed", url)

    def test_header_is_ignored_on_reads(self):
        self.assertEqual(self.client.get("/api/data/", HTTP_X_SHEET_SCOPE="account").status_code, 200)
        self.assertEqual(self.client.get("/api/sheet-config/", HTTP_X_SHEET_SCOPE="account").status_code, 200)
        response = self.client.get("/api/data/portfolio/", HTTP_X_SHEET_SCOPE="account")
        self.assertEqual(response.json()["code"], "table_not_found")

    def test_signed_in_account_syncs_its_own_data(self):
        self.client.force_login(self.user)
        with fake_sync(TabResult(tab="portfolio", ok=True, saved=True, rows=1)) as sync:
            response = self.client.post("/api/data/sync/", HTTP_X_SHEET_SCOPE="account")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(sync.call_args.args[0].owner, self.user)

    def test_put_without_json_object_is_refused(self):
        for url in ("/api/sheet-config/", "/api/sheet-config/tabs/"):
            response = self.client.put(url, json.dumps(["x"]), content_type="application/json")
            self.assertEqual((response.status_code, response.json()["code"]), (400, "invalid_json"), url)
