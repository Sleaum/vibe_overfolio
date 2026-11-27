"""Erreurs de gspread et de requests traduites en SheetAPIError : mêmes codes, messages et paramètres partout."""
from types import MappingProxyType
from unittest import mock

import gspread
from django.test import TestCase
from requests.exceptions import ConnectionError as RequestsConnectionError

from . import config, services
from .services import SheetAPIError, SheetNotFound


def api_error(message="quota dépassé"):
    response = mock.Mock()
    response.json.return_value = {"error": {"code": 429, "message": message, "status": "RESOURCE_EXHAUSTED"}}
    return gspread.exceptions.APIError(response)


API_DETAIL = "APIError: [429]: quota dépassé"


class GoogleErrorTranslationTests(TestCase):
    def assert_api_error(self, call):
        with self.assertRaises(SheetAPIError) as caught:
            call()
        error = caught.exception
        self.assertEqual(error.status, 502)
        self.assertEqual(error.code, "google_api_error")
        self.assertEqual(str(error), f"Erreur de l'API Google Sheets : {API_DETAIL}")
        self.assertEqual(error.params, {"detail": API_DETAIL})

    def assert_unreachable(self, call):
        with self.assertRaises(SheetAPIError) as caught:
            call()
        error = caught.exception
        self.assertEqual(error.code, "google_unreachable")
        self.assertEqual(str(error), "Google Sheets est injoignable : réseau coupé")
        self.assertEqual(error.params, {"detail": "réseau coupé"})

    def spreadsheet(self, side_effect):
        sheet = mock.Mock(spec=["worksheets", "worksheet", "get_worksheet"])
        sheet.worksheets.side_effect = side_effect
        sheet.worksheet.side_effect = side_effect
        return sheet

    def test_worksheet_titles(self):
        self.assert_api_error(lambda: services.worksheet_titles(self.spreadsheet(api_error())))
        self.assert_unreachable(lambda: services.worksheet_titles(self.spreadsheet(RequestsConnectionError("réseau coupé"))))

    def test_read_worksheet_values(self):
        self.assert_api_error(lambda: services.read_worksheet_values(self.spreadsheet(api_error()), "portfolio"))
        self.assert_unreachable(
            lambda: services.read_worksheet_values(self.spreadsheet(RequestsConnectionError("réseau coupé")), "portfolio")
        )

    def test_read_worksheet_values_keeps_its_own_errors(self):
        missing = self.spreadsheet(gspread.exceptions.WorksheetNotFound("portfolio"))
        with self.assertRaises(SheetNotFound) as caught:
            services.read_worksheet_values(missing, "portfolio")
        self.assertEqual((caught.exception.code, caught.exception.params), ("tab_not_found", {"tab": "portfolio"}))

        empty = mock.Mock(spec=["get_worksheet"])
        empty.get_worksheet.return_value = None
        with self.assertRaises(SheetNotFound) as caught:
            services.read_worksheet_values(empty)
        self.assertEqual(caught.exception.code, "no_tabs")

    def service_account_settings(self):
        values = {
            **config.default_values(),
            "project_id": "projet",
            "private_key": "-----BEGIN PRIVATE KEY-----\nABC\n-----END PRIVATE KEY-----\n",
            "client_email": "sa@x.iam",
            "sheet_id": "id-du-site",
            "method": "",
        }
        return config.SheetSettings(None, "page", MappingProxyType(values))

    def client_failing_with(self, side_effect):
        client = mock.Mock()
        client.open_by_key.side_effect = side_effect
        return mock.patch.object(services, "get_client", return_value=client)

    def test_open_spreadsheet_with_service_account(self):
        settings = self.service_account_settings()
        self.assertEqual(settings.mode, "service_account")
        for side_effect, check in ((api_error(), self.assert_api_error), (RequestsConnectionError("réseau coupé"), self.assert_unreachable)):
            with self.client_failing_with(side_effect):
                check(lambda: services.open_spreadsheet(settings))

    def test_open_spreadsheet_not_found_names_the_account(self):
        with self.client_failing_with(gspread.exceptions.SpreadsheetNotFound()):
            with self.assertRaises(SheetNotFound) as caught:
                services.open_spreadsheet(self.service_account_settings())
        self.assertEqual(caught.exception.code, "sheet_not_found_by_id")
        self.assertEqual(caught.exception.params, {"name": "overfolio", "email": "sa@x.iam"})

    def test_open_google_account_spreadsheet(self):
        for side_effect, check in ((api_error(), self.assert_api_error), (RequestsConnectionError("réseau coupé"), self.assert_unreachable)):
            client = mock.Mock()
            client.open_by_key.side_effect = side_effect
            with mock.patch("accounts.drive.fresh_credentials"), mock.patch.object(services.gspread, "authorize", return_value=client):
                check(lambda: services.open_google_account_spreadsheet(object(), "id-choisi"))

    def test_open_public_spreadsheet(self):
        with mock.patch.object(services.requests, "get", side_effect=RequestsConnectionError("réseau coupé")):
            self.assert_unreachable(lambda: services.open_public_spreadsheet("id-public"))

    def test_google_account_errors_do_not_log_google_message(self):
        """Mode compte Google : la réponse de Google, qui peut parler du document de la personne, reste hors des logs."""
        client = mock.Mock()
        client.open_by_key.side_effect = api_error("Document « Patrimoine Alice » : accès refusé")
        with mock.patch("accounts.drive.fresh_credentials"), mock.patch.object(services.gspread, "authorize", return_value=client):
            with self.assertLogs("googlesheet.services", level="WARNING") as logs, self.assertRaises(SheetAPIError):
                services.open_google_account_spreadsheet(object(), "id-choisi")
        self.assertNotIn("Alice", "\n".join(logs.output))
