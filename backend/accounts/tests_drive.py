import json
from unittest import mock
from urllib.parse import parse_qs, urlparse

from cryptography.fernet import Fernet
from django.test import Client, TestCase
from google.auth.exceptions import RefreshError
from google.oauth2.credentials import Credentials

from googlesheet.models import SheetConfig, SheetRow, SheetTable

from . import drive
from .models import GoogleAccount
from .tests import CLAIMS, ENV as LOGIN_ENV, fake_fetch_token, verified
from .views import SESSION_KEY

KEY = Fernet.generate_key().decode()
ENV = {
    **LOGIN_ENV,
    "GOOGLE_PICKER_API_KEY": "cle-api-picker",
    "GOOGLE_CLOUD_PROJECT_NUMBER": "123456789012",
    "FIELD_ENCRYPTION_KEY": KEY,
    # .env du site : un compte de service et une feuille, qu'aucun compte ne doit recevoir
    "TYPE": "service_account",
    "PROJECT_ID": "projet-site",
    "PRIVATE_KEY": "-----BEGIN PRIVATE KEY-----\\nSITE\\n-----END PRIVATE KEY-----\\n",
    "CLIENT_EMAIL": "site@projet.iam.gserviceaccount.com",
    "GOOGLE_SHEET_ID": "id-feuille-du-site",
    "SHEET_SYNC_TABS": "portfolio",
}
DRIVE = "https://www.googleapis.com/auth/drive.file"
REFRESH = "jeton-de-rafraichissement-secret"


def drive_tokens(scope=None, refresh_token=REFRESH):
    """Échange du code simulé pour l'autorisation du mode 3."""

    def fetch_token(self, **kwargs):
        self.oauth2session.token = {
            "access_token": "acces",
            "token_type": "Bearer",
            "id_token": "jeton-id",
            "scope": scope or f"openid https://www.googleapis.com/auth/userinfo.email {DRIVE}",
            **({"refresh_token": refresh_token} if refresh_token else {}),
        }
        return self.oauth2session.token

    return mock.patch("google_auth_oauthlib.flow.Flow.fetch_token", autospec=True, side_effect=fetch_token)


def refreshed(token="acces-court"):
    def refresh(self, request):
        self.token = token
        self.expiry = None

    return mock.patch.object(Credentials, "refresh", autospec=True, side_effect=refresh)


class AccountBase(TestCase):
    def setUp(self):
        # Réglages Google et .env du site pour chaque test (un décorateur de classe ne vaut pas pour les sous-classes)
        patcher = mock.patch.dict("os.environ", ENV, clear=False)
        patcher.start()
        self.addCleanup(patcher.stop)

    def sign_in(self, claims=CLAIMS):
        client = Client(enforce_csrf_checks=True)
        client.get("/api/auth/google/start/")
        state = client.session[SESSION_KEY]["state"]
        with fake_fetch_token(), verified(claims):
            client.get("/api/auth/google/callback/", {"state": state, "code": "c"})
        client.get("/api/auth/me/")
        client.csrf = client.cookies["csrftoken"].value
        return client

    def authorize(self, client, claims=CLAIMS, scope=None, refresh_token=REFRESH):
        response = client.get("/api/auth/google/drive/start/", {"next": "/sheet"})
        state = client.session[SESSION_KEY]["state"]
        with drive_tokens(scope, refresh_token), verified(claims):
            return response, client.get("/api/auth/google/callback/", {"state": state, "code": "c"})

    def put(self, client, url, data):
        return client.put(url, json.dumps(data), content_type="application/json", HTTP_X_CSRFTOKEN=getattr(client, "csrf", ""))

    def post(self, client, url):
        return client.post(url, HTTP_X_CSRFTOKEN=getattr(client, "csrf", ""))


class DriveAuthorizationTests(AccountBase):
    def test_start_asks_google_for_drive_file_offline(self):
        alice = self.sign_in()
        response = alice.get("/api/auth/google/drive/start/", {"next": "/sheet"})
        query = parse_qs(urlparse(response["Location"]).query)
        self.assertEqual(urlparse(response["Location"]).netloc, "accounts.google.com")
        self.assertIn(DRIVE, query["scope"][0])
        self.assertEqual(query["access_type"], ["offline"])
        self.assertEqual(query["prompt"], ["consent"])
        self.assertEqual(query["include_granted_scopes"], ["true"])
        self.assertEqual(query["login_hint"], ["alice@gmail.com"])
        self.assertEqual(query["code_challenge_method"], ["S256"])

    def test_start_requires_sign_in(self):
        response = self.client.get("/api/auth/google/drive/start/", {"next": "/sheet"})
        self.assertEqual(response["Location"], "/newpage?next=/sheet")

    def test_refresh_token_is_encrypted_and_never_sent(self):
        alice = self.sign_in()
        _, response = self.authorize(alice)
        self.assertEqual(response["Location"], "/sheet?google=connected")
        account = GoogleAccount.objects.get()
        self.assertTrue(account.drive_refresh_token)
        self.assertNotIn(REFRESH, account.drive_refresh_token)
        self.assertEqual(Fernet(KEY.encode()).decrypt(account.drive_refresh_token.encode()).decode(), REFRESH)
        for url in ("/api/auth/me/", "/api/profile/", "/api/sheet-config/"):
            self.assertNotIn(REFRESH, alice.get(url).content.decode(), url)
            self.assertNotIn(account.drive_refresh_token, alice.get(url).content.decode(), url)
        self.assertTrue(alice.get("/api/sheet-config/").json()["google"]["authorized"])

    def test_other_google_account_is_refused(self):
        alice = self.sign_in()
        _, response = self.authorize(alice, claims={**CLAIMS, "sub": "autre-compte"})
        self.assertEqual(response["Location"], "/sheet?google_error=google_account_mismatch")
        self.assertFalse(GoogleAccount.objects.get().drive_refresh_token)

    def test_unticked_drive_permission(self):
        alice = self.sign_in()
        _, response = self.authorize(alice, scope="openid https://www.googleapis.com/auth/userinfo.email")
        self.assertEqual(response["Location"], "/sheet?google_error=google_drive_denied")
        self.assertFalse(GoogleAccount.objects.get().drive_refresh_token)

    def test_missing_refresh_token(self):
        alice = self.sign_in()
        _, response = self.authorize(alice, refresh_token=None)
        self.assertEqual(response["Location"], "/sheet?google_error=google_token_failed")

    def test_drive_state_from_another_session_is_refused(self):
        alice = self.sign_in()
        alice.get("/api/auth/google/drive/start/", {"next": "/sheet"})
        state = alice.session[SESSION_KEY]["state"]
        bob = self.sign_in({**CLAIMS, "sub": "bob", "email": "bob@gmail.com"})
        with drive_tokens(), verified(CLAIMS):
            response = bob.get("/api/auth/google/callback/", {"state": state, "code": "c"})
        self.assertIn("error=google_state_invalid", response["Location"])
        self.assertFalse(GoogleAccount.objects.filter(drive_refresh_token__gt="").exists())

    def test_picker_token(self):
        alice = self.sign_in()
        self.assertEqual(alice.get("/api/auth/google/picker-token/").json()["code"], "google_not_authorized")
        self.authorize(alice)
        with refreshed("acces-court"):
            response = alice.get("/api/auth/google/picker-token/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response["Cache-Control"], "no-store")
        body = response.json()
        self.assertEqual(body["access_token"], "acces-court")
        self.assertEqual(body["api_key"], "cle-api-picker")
        self.assertEqual(body["app_id"], "123456789012")
        self.assertNotIn(REFRESH, response.content.decode())

    def test_picker_token_requires_sign_in(self):
        response = self.client.get("/api/auth/google/picker-token/")
        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.json()["code"], "login_required")

    def test_revoked_access_is_forgotten(self):
        alice = self.sign_in()
        self.authorize(alice)
        with mock.patch.object(Credentials, "refresh", side_effect=RefreshError("invalid_grant: Token has been expired or revoked.", {"error": "invalid_grant"})):
            response = alice.get("/api/auth/google/picker-token/")
        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.json()["code"], "google_access_revoked")
        self.assertFalse(GoogleAccount.objects.get().drive_refresh_token)

    def test_temporary_google_error_keeps_access(self):
        alice = self.sign_in()
        self.authorize(alice)
        error = RefreshError("temporarily_unavailable", {"error": "temporarily_unavailable"}, retryable=True)
        with mock.patch.object(Credentials, "refresh", side_effect=error):
            response = alice.get("/api/auth/google/picker-token/")
        self.assertEqual((response.status_code, response.json()["code"]), (502, "google_unreachable"))
        self.assertTrue(GoogleAccount.objects.get().drive_refresh_token)

    def test_changed_encryption_key_asks_to_authorize_again(self):
        alice = self.sign_in()
        self.authorize(alice)
        with mock.patch.dict("os.environ", {"FIELD_ENCRYPTION_KEY": Fernet.generate_key().decode()}):
            response = alice.get("/api/auth/google/picker-token/")
            self.assertEqual((response.status_code, response.json()["code"]), (409, "google_not_authorized"))
            self.assertFalse(alice.get("/api/sheet-config/").json()["google"]["authorized"])

    def test_refusal_at_google_returns_to_sheet_page(self):
        alice = self.sign_in()
        alice.get("/api/auth/google/drive/start/", {"next": "/sheet"})
        state = alice.session[SESSION_KEY]["state"]
        response = alice.get("/api/auth/google/callback/", {"state": state, "error": "access_denied"})
        self.assertEqual(response["Location"], "/sheet?google_error=google_denied")
        self.assertTrue(alice.get("/api/auth/me/").json()["authenticated"])  # toujours connecté

    def test_admin_hides_encrypted_token(self):
        from django.contrib import admin

        model_admin = admin.site._registry[GoogleAccount]
        self.assertIn("drive_refresh_token", model_admin.exclude)

    def test_revoke(self):
        alice = self.sign_in()
        self.authorize(alice)
        self.assertEqual(alice.post("/api/auth/google/drive/revoke/").status_code, 403)  # CSRF exigé
        with mock.patch("accounts.drive.requests.post") as post:
            response = self.post(alice, "/api/auth/google/drive/revoke/")
        self.assertEqual(response.json(), {"authorized": False})
        self.assertEqual(post.call_args.kwargs["data"], {"token": REFRESH})
        self.assertFalse(GoogleAccount.objects.get().drive_refresh_token)

    def test_not_configured_without_picker_or_valid_key(self):
        alice = self.sign_in()
        for missing in ({"GOOGLE_PICKER_API_KEY": ""}, {"FIELD_ENCRYPTION_KEY": "pas-une-cle"}):
            with mock.patch.dict("os.environ", missing):
                self.assertFalse(alice.get("/api/sheet-config/").json()["google"]["available"])
                response = alice.get("/api/auth/google/drive/start/", {"next": "/sheet"})
                self.assertEqual(response["Location"], "/sheet?google_error=google_drive_not_configured")


class GoogleModeConfigTests(AccountBase):
    def test_google_mode_requires_account_and_authorization(self):
        visitor = Client(enforce_csrf_checks=True)
        response = self.put(visitor, "/api/sheet-config/", {"method": "google", "sheet_id": "id-choisi"})
        self.assertEqual(response.json()["field_codes"], {"method": "google_requires_account"})
        alice = self.sign_in()
        response = self.put(alice, "/api/sheet-config/", {"method": "google", "sheet_id": "id-choisi"})
        self.assertEqual(response.json()["field_codes"], {"method": "google_not_authorized"})

    def test_google_mode_reads_chosen_sheet_with_user_account(self):
        alice = self.sign_in()
        self.authorize(alice)
        response = self.put(alice, "/api/sheet-config/", {"method": "google", "sheet_id": "id-choisi", "doc_name": "Mon patrimoine"})
        self.assertEqual(response.status_code, 200, response.content)
        body = response.json()
        self.assertEqual((body["mode"], body["method"], body["values"]["sheet_id"]), ("google", "google", "id-choisi"))
        self.assertEqual(body["values"]["client_email"], "")

        worksheet = mock.Mock()
        worksheet.title = "portfolio"
        spreadsheet = mock.Mock()
        spreadsheet.worksheets.return_value = [worksheet]
        client = mock.Mock()
        client.open_by_key.return_value = spreadsheet
        with refreshed(), mock.patch("googlesheet.services.gspread.authorize", return_value=client) as authorize:
            tabs = alice.get("/api/sheet-config/tabs/").json()
        self.assertEqual(tabs["tabs"], ["portfolio"])
        self.assertEqual(tabs["mode"], "google")
        client.open_by_key.assert_called_once_with("id-choisi")
        self.assertEqual(authorize.call_args.args[0].refresh_token, REFRESH)

    def test_google_mode_without_access_any_more(self):
        alice = self.sign_in()
        self.authorize(alice)
        self.put(alice, "/api/sheet-config/", {"method": "google", "sheet_id": "id-choisi"})
        self.post(alice, "/api/auth/google/drive/revoke/")
        response = alice.get("/api/sheet-config/tabs/")
        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.json()["code"], "google_not_authorized")


class ScopeHeaderTests(AccountBase):
    """La page dit quelle configuration elle modifie : une session expirée n'envoie rien vers celle du site."""

    def scoped_put(self, client, url, data, scope):
        return client.put(url, json.dumps(data), content_type="application/json",
                          HTTP_X_CSRFTOKEN=getattr(client, "csrf", ""), HTTP_X_SHEET_SCOPE=scope)

    def test_expired_session_does_not_write_site_config(self):
        alice = self.sign_in()
        self.post(alice, "/api/auth/logout/")  # session expirée ou fermée dans un autre onglet
        payload = {"sheet_id": "feuille-privee-alice", "clear_credentials": True}
        for url, data in (("/api/sheet-config/", payload), ("/api/sheet-config/tabs/", {"sync_tabs": "portfolio"})):
            response = self.scoped_put(alice, url, data, "account")
            self.assertEqual((response.status_code, response.json()["code"]), (401, "session_expired"), url)
        response = alice.post("/api/data/sync/", HTTP_X_SHEET_SCOPE="account")
        self.assertEqual(response.status_code, 401)
        response = alice.delete("/api/sheet-config/", HTTP_X_SHEET_SCOPE="account")
        self.assertEqual(response.status_code, 401)
        self.assertFalse(SheetConfig.objects.exists())
        self.assertEqual(Client().get("/api/sheet-config/").json()["values"]["sheet_id"], "id-feuille-du-site")

    def test_signed_in_elsewhere_does_not_write_account_from_site_page(self):
        alice = self.sign_in()
        response = self.scoped_put(alice, "/api/sheet-config/", {"sheet_id": "x", "clear_credentials": True}, "site")
        self.assertEqual((response.status_code, response.json()["code"]), (409, "scope_changed"))

    def test_matching_scope_and_no_header_still_work(self):
        alice = self.sign_in()
        self.assertEqual(self.scoped_put(alice, "/api/sheet-config/", {"sheet_id": "id-alice"}, "account").status_code, 200)
        visitor = Client()
        response = self.scoped_put(visitor, "/api/sheet-config/tabs/", {"sync_tabs": "portfolio"}, "site")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(self.put(visitor, "/api/sheet-config/tabs/", {"sync_tabs": "portfolio"}).status_code, 200)


class PerAccountSheetTests(AccountBase):
    def test_account_never_inherits_site_env(self):
        alice = self.sign_in()
        view = alice.get("/api/sheet-config/").json()
        self.assertEqual((view["scope"], view["source"], view["mode"]), ("account", "none", "none"))
        self.assertEqual(view["values"]["sheet_id"], "")
        self.assertEqual(view["values"]["client_email"], "")
        self.assertFalse(view["private_key_set"])
        self.assertEqual(view["env"]["values"]["sheet_id"], "")
        self.assertIsNone(view["account"]["source"])  # le compte de service du site n'est pas proposé
        site = Client().get("/api/sheet-config/").json()
        self.assertEqual((site["scope"], site["source"], site["values"]["sheet_id"]), ("site", "env", "id-feuille-du-site"))

    def test_account_cannot_reuse_site_service_account_key(self):
        """Taper l'e-mail du compte de service du site ne donne pas sa clé privée à un compte."""
        alice = self.sign_in()
        response = self.put(alice, "/api/sheet-config/", {
            "type": "service_account", "project_id": "projet-site",
            "client_email": "site@projet.iam.gserviceaccount.com", "sheet_id": "id-feuille-du-site",
        })
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["field_codes"], {"private_key": "required"})
        self.assertFalse(SheetConfig.objects.filter(user__isnull=False).exists())

    def test_configs_are_isolated(self):
        alice = self.sign_in()
        bob = self.sign_in({**CLAIMS, "sub": "bob", "email": "bob@gmail.com"})
        self.assertEqual(self.put(alice, "/api/sheet-config/", {"sheet_id": "id-alice"}).status_code, 200)
        self.assertEqual(alice.get("/api/sheet-config/").json()["values"]["sheet_id"], "id-alice")
        self.assertEqual(bob.get("/api/sheet-config/").json()["values"]["sheet_id"], "")
        self.assertEqual(Client().get("/api/sheet-config/").json()["values"]["sheet_id"], "id-feuille-du-site")
        self.assertFalse(SheetConfig.objects.filter(user__isnull=True).exists())  # site : toujours le .env
        alice.delete("/api/sheet-config/", HTTP_X_CSRFTOKEN=alice.csrf)
        self.assertEqual(alice.get("/api/sheet-config/").json()["source"], "none")

    def test_site_and_account_configs_coexist(self):
        """La ligne du site (identifiant 1, comme avant) et celle d'un compte vivent ensemble."""
        visitor = Client()
        self.assertEqual(self.put(visitor, "/api/sheet-config/", {"sheet_id": "id-site-saisi", "clear_credentials": True}).status_code, 200)
        alice = self.sign_in()
        self.assertEqual(self.put(alice, "/api/sheet-config/tabs/", {"sync_tabs": "portfolio, budget"}).status_code, 200)
        self.assertEqual(SheetConfig.objects.count(), 2)
        self.assertEqual(visitor.get("/api/sheet-config/").json()["values"]["sheet_id"], "id-site-saisi")

    def make_table(self, owner, name, rows):
        table = SheetTable.objects.create(user=owner, name=name, columns=["Asset"], row_count=len(rows), source="x")
        for i, row in enumerate(rows):
            SheetRow.objects.create(table=table, position=i, data=row)

    def test_data_is_isolated(self):
        alice = self.sign_in()
        bob = self.sign_in({**CLAIMS, "sub": "bob", "email": "bob@gmail.com"})
        alice_user = GoogleAccount.objects.get(sub=CLAIMS["sub"]).user
        self.make_table(None, "portfolio", [{"Asset": "site"}])
        self.make_table(alice_user, "portfolio", [{"Asset": "alice"}])

        self.assertEqual(Client().get("/api/data/portfolio/").json()["rows"], [{"Asset": "site"}])
        self.assertEqual(alice.get("/api/data/portfolio/").json()["rows"], [{"Asset": "alice"}])
        self.assertEqual(bob.get("/api/data/").json(), [])
        self.assertEqual(bob.get("/api/data/portfolio/").status_code, 404)

    def test_sync_writes_only_own_tables(self):
        alice = self.sign_in()
        alice_user = GoogleAccount.objects.get(sub=CLAIMS["sub"]).user
        self.make_table(None, "portfolio", [{"Asset": "site"}])
        self.make_table(None, "ancien", [{"Asset": "site"}])
        self.put(alice, "/api/sheet-config/", {"sheet_id": "id-alice", "sync_tabs": "portfolio"})
        self.put(alice, "/api/sheet-config/tabs/", {"sync_tabs": "portfolio"})

        values = [["Asset", "Assets Master Currency"], ["crypto", 10]]
        with mock.patch("googlesheet.sync.open_spreadsheet", return_value=object()) as opened, \
                mock.patch("googlesheet.sync.read_worksheet_values", return_value=values):
            response = self.post(alice, "/api/data/sync/")
        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(opened.call_args.args[1], alice_user)
        self.assertEqual(alice.get("/api/data/portfolio/").json()["rows"], [{"Asset": "crypto", "Assets Master Currency": 10}])
        # Les tables du site ne sont ni écrasées ni retirées
        self.assertEqual(sorted(SheetTable.objects.filter(user=None).values_list("name", flat=True)), ["ancien", "portfolio"])
        self.assertEqual(Client().get("/api/data/portfolio/").json()["rows"], [{"Asset": "site"}])
