import json
from unittest import mock

from django.test import TestCase

from .config import table_names
from .models import SheetConfig, SheetTable

ENV = {"GOOGLE_SHEET_ID": "id-site", "SHEET_SYNC_TABS": "portfolio,history"}
VALUES = {
    "history": [["Date", "Asset", "EUR"], ["2026-11-01", "crypto", 10]],
    "portfolio": [["Asset", "Assets Master Currency"], ["fiat", 20]],
    "Positions": [["Asset", "Assets Master Currency"], ["crypto", 30]],
}


def read_tab(spreadsheet, tab):
    return VALUES[tab]


@mock.patch.dict("os.environ", ENV, clear=False)
class TabMapTests(TestCase):
    url = "/api/sheet-config/tab-map/"

    def setUp(self):
        from django.core.cache import cache

        cache.clear()  # verrou « synchronisation trop rapprochée » d'un test précédent

    def put(self, mapping):
        return self.client.put(self.url, json.dumps({"tab_map": mapping}), content_type="application/json")

    def sync(self):
        with mock.patch("googlesheet.sync.open_spreadsheet", return_value=object()), \
                mock.patch("googlesheet.sync.read_worksheet_values", side_effect=read_tab):
            return self.client.post("/api/data/sync/")

    def test_mapping_is_saved_and_returned(self):
        response = self.put({"_history": "history", "portfolio": "portfolio", "inout": ""})
        self.assertEqual(response.status_code, 200, response.content)
        body = response.json()
        # Même nom ou vide : c'est le défaut, rien n'est gardé
        self.assertEqual(body["tab_map"], {"_history": "history"})
        self.assertEqual(body["site_tabs"], ["portfolio", "_history", "inout", "budget", "stock"])
        self.assertEqual(self.client.get("/api/sheet-config/").json()["tab_map"], {"_history": "history"})
        # Le reste de la configuration (repli sur le .env) est repris tel quel
        self.assertEqual(SheetConfig.objects.get().sheet_id, "id-site")

    def test_invalid_mappings(self):
        for mapping, code in (
            ({"inconnu": "x"}, "invalid_tab_map"),
            ({"_history": 3}, "invalid_tab_map"),
            ({"_history": "x" * 101}, "invalid_tab_map"),
            ({"_history": "history", "inout": "history"}, "tab_map_duplicate"),
        ):
            response = self.put(mapping)
            self.assertEqual((response.status_code, response.json()["code"]), (400, code), mapping)
        response = self.client.put(self.url, json.dumps({"tab_map": ["history"]}), content_type="application/json")
        self.assertEqual(response.json()["code"], "invalid_tab_map")

    def test_sync_stores_mapped_tab_under_site_name(self):
        self.put({"_history": "history"})
        response = self.sync()
        self.assertEqual(response.status_code, 200, response.content)
        tabs = {tab["name"]: tab for tab in response.json()["tabs"]}
        self.assertEqual(tabs["history"]["table"], "_history")
        self.assertTrue(tabs["history"]["ok"])
        self.assertEqual(self.client.get("/api/data/_history/").json()["rows"], [{"Date": "2026-11-01", "Asset": "crypto", "EUR": 10}])
        self.assertEqual(self.client.get("/api/data/history/").status_code, 404)
        self.assertEqual([table["name"] for table in self.client.get("/api/data/").json()], ["portfolio", "_history"])

    def test_old_copy_under_document_name_is_replaced(self):
        SheetTable.objects.create(name="history", source="id-site", columns=["A"], row_count=1)
        self.put({"_history": "history"})
        self.sync()
        self.assertEqual(sorted(SheetTable.objects.values_list("name", flat=True)), ["_history", "portfolio"])

    def test_tab_with_site_name_is_skipped_when_name_is_taken(self):
        """« Positions » relié à portfolio : un onglet du document nommé portfolio n'écrase pas la table."""
        self.client.put("/api/sheet-config/tabs/", json.dumps({"sync_tabs": "Positions, portfolio"}), content_type="application/json")
        self.put({"portfolio": "Positions"})
        response = self.sync()
        tabs = {tab["name"]: tab for tab in response.json()["tabs"]}
        self.assertEqual(tabs["portfolio"]["code"], "tab_shadowed")
        self.assertEqual(self.client.get("/api/data/portfolio/").json()["rows"], [{"Asset": "crypto", "Assets Master Currency": 30}])

    def test_table_names(self):
        names, shadowed = table_names(["history", "_history", "budget"], {"_history": "history"})
        self.assertEqual(names, {"history": "_history", "budget": "budget"})
        self.assertEqual(shadowed, ["_history"])

    def test_mapping_is_per_owner(self):
        from django.contrib.auth import get_user_model

        self.put({"_history": "history"})
        user = get_user_model().objects.create(username="alice")
        self.client.force_login(user)
        self.assertEqual(self.client.get("/api/sheet-config/").json()["tab_map"], {})
        self.put({"portfolio": "Positions"})
        self.client.logout()
        self.assertEqual(self.client.get("/api/sheet-config/").json()["tab_map"], {"_history": "history"})

    def test_expired_session_does_not_change_site_mapping(self):
        response = self.client.put(self.url, json.dumps({"tab_map": {"_history": "x"}}), content_type="application/json",
                                   HTTP_X_SHEET_SCOPE="account")
        self.assertEqual((response.status_code, response.json()["code"]), (401, "session_expired"))
        self.assertFalse(SheetConfig.objects.exists())
