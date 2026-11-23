import json
from unittest import mock
from urllib.parse import parse_qs, urlparse

from django.contrib.auth import get_user_model
from django.test import Client, TestCase
from google_auth_oauthlib.flow import Flow

from profiles.models import Profile

from .models import GoogleAccount
from .views import SESSION_KEY, safe_next

ENV = {
    "GOOGLE_OAUTH_CLIENT_ID": "client-id.apps.googleusercontent.com",
    "GOOGLE_OAUTH_CLIENT_SECRET": "secret-de-test",
    "GOOGLE_OAUTH_REDIRECT_URI": "http://localhost/api/auth/google/callback/",
}
NO_GOOGLE = {name: "" for name in ENV}

CLAIMS = {
    "sub": "1234567890",
    "email": "alice@gmail.com",
    "email_verified": True,
    "name": "Alice Martin",
    "given_name": "Alice",
    "family_name": "Martin",
    "picture": "https://lh3.googleusercontent.com/a/alice",
}


def fake_fetch_token(id_token="jeton-id"):
    """Remplace l'échange du code chez Google : la session OAuth reçoit des jetons de test."""

    def fetch_token(self, **kwargs):
        self.oauth2session.token = {"access_token": "acces", "token_type": "Bearer", "id_token": id_token}
        return self.oauth2session.token

    return mock.patch.object(Flow, "fetch_token", autospec=True, side_effect=fetch_token)


def verified(claims):
    return mock.patch("accounts.google.id_token.verify_oauth2_token", return_value=dict(claims))


@mock.patch.dict("os.environ", ENV, clear=False)
class GoogleLoginTests(TestCase):
    def start(self, client=None, next_url="/graphiques"):
        client = client or self.client
        response = client.get("/api/auth/google/start/", {"next": next_url})
        return response, client.session[SESSION_KEY]

    def login_as(self, claims=CLAIMS, client=None, next_url="/graphiques"):
        client = client or self.client
        _, pending = self.start(client, next_url)
        with fake_fetch_token(), verified(claims):
            return client.get("/api/auth/google/callback/", {"state": pending["state"], "code": "code-google"})

    def test_start_redirects_to_google_with_state_and_pkce(self):
        response, pending = self.start()
        self.assertEqual(response.status_code, 302)
        url = urlparse(response["Location"])
        query = parse_qs(url.query)
        self.assertEqual(url.netloc, "accounts.google.com")
        self.assertEqual(query["client_id"], [ENV["GOOGLE_OAUTH_CLIENT_ID"]])
        self.assertEqual(query["redirect_uri"], [ENV["GOOGLE_OAUTH_REDIRECT_URI"]])
        self.assertEqual(query["state"], [pending["state"]])
        self.assertEqual(query["code_challenge_method"], ["S256"])
        self.assertIn("code_challenge", query)
        self.assertEqual(query["access_type"], ["online"])
        self.assertIn("openid", query["scope"][0])
        self.assertTrue(pending["code_verifier"])
        self.assertNotIn(pending["code_verifier"], response["Location"])  # seul le défi part chez Google
        self.assertEqual(pending["next"], "/graphiques")

    def test_next_is_limited_to_site_pages(self):
        for value in ("//evil.example", "https://evil.example", "/\\evil.example", "/api/auth/logout/", "", None, "page"):
            self.assertEqual(safe_next(value), "/", value)
        self.assertEqual(safe_next("/graphiques/flux?annee=2026"), "/graphiques/flux?annee=2026")

    def test_callback_creates_user_and_logs_in(self):
        site = Profile.site_profile()
        site.asset_colors = {"crypto": "#9334e6"}
        site.theme = "dark"
        site.save()

        response = self.login_as()
        self.assertEqual(response.status_code, 302)
        self.assertEqual(response["Location"], "/graphiques")
        account = GoogleAccount.objects.get(sub=CLAIMS["sub"])
        self.assertEqual(account.email, "alice@gmail.com")
        self.assertEqual(account.user.first_name, "Alice")
        self.assertFalse(account.user.has_usable_password())
        # Réglages du site recopiés une fois sur le nouveau profil
        profile = Profile.objects.get(user=account.user)
        self.assertEqual(profile.asset_colors, {"crypto": "#9334e6"})
        self.assertEqual(profile.theme, "dark")

        me = self.client.get("/api/auth/me/").json()
        self.assertTrue(me["authenticated"])
        self.assertTrue(me["first_login"])
        self.assertEqual(me["user"], {"email": "alice@gmail.com", "name": "Alice Martin", "picture": CLAIMS["picture"]})
        self.assertFalse(self.client.get("/api/auth/me/").json()["first_login"])  # une seule fois

    def test_same_google_account_finds_same_user(self):
        self.login_as()
        self.client.post("/api/auth/logout/")
        changed = {**CLAIMS, "email": "alice.martin@gmail.com", "name": "Alice M."}
        self.login_as(changed)
        self.assertEqual(get_user_model().objects.count(), 1)
        account = GoogleAccount.objects.get()
        self.assertEqual(account.email, "alice.martin@gmail.com")
        self.assertEqual(account.user.email, "alice.martin@gmail.com")
        self.assertFalse(self.client.get("/api/auth/me/").json()["first_login"])

    def test_session_key_changes_on_login(self):
        self.start()
        before = self.client.session.session_key
        self.login_as()
        self.assertNotEqual(self.client.session.session_key, before)

    def assert_failed(self, response, code):
        self.assertEqual(response.status_code, 302)
        self.assertEqual(response["Location"], f"/newpage?error={code}")
        self.assertFalse(self.client.get("/api/auth/me/").json()["authenticated"])

    def test_invalid_state_is_refused(self):
        _, pending = self.start()
        with fake_fetch_token(), verified(CLAIMS):
            response = self.client.get("/api/auth/google/callback/", {"state": "autre", "code": "c"})
        self.assert_failed(response, "google_state_invalid")
        # Le state est à usage unique : même le bon ne passe plus
        with fake_fetch_token(), verified(CLAIMS):
            response = self.client.get("/api/auth/google/callback/", {"state": pending["state"], "code": "c"})
        self.assert_failed(response, "google_state_invalid")

    def test_callback_without_start_is_refused(self):
        with fake_fetch_token(), verified(CLAIMS):
            response = self.client.get("/api/auth/google/callback/", {"state": "x", "code": "c"})
        self.assert_failed(response, "google_state_invalid")

    def test_denied_consent(self):
        _, pending = self.start()
        response = self.client.get("/api/auth/google/callback/", {"state": pending["state"], "error": "access_denied"})
        self.assert_failed(response, "google_denied")

    def test_token_exchange_failure(self):
        _, pending = self.start()
        with mock.patch.object(Flow, "fetch_token", side_effect=RuntimeError("invalid_grant")):
            response = self.client.get("/api/auth/google/callback/", {"state": pending["state"], "code": "c"})
        self.assert_failed(response, "google_token_failed")

    def test_invalid_id_token(self):
        _, pending = self.start()
        with fake_fetch_token(), mock.patch("accounts.google.id_token.verify_oauth2_token", side_effect=ValueError("bad")):
            response = self.client.get("/api/auth/google/callback/", {"state": pending["state"], "code": "c"})
        self.assert_failed(response, "google_token_invalid")
        self.assertFalse(GoogleAccount.objects.exists())

    def test_unverified_email(self):
        response = self.login_as({**CLAIMS, "email_verified": False})
        self.assert_failed(response, "google_email_unverified")
        self.assertFalse(GoogleAccount.objects.exists())

    def test_tokens_are_not_kept(self):
        """La connexion ne garde aucun jeton Google : ni en base, ni dans la session, ni dans une réponse."""
        self.login_as()
        session = dict(self.client.session)
        self.assertNotIn(SESSION_KEY, session)
        self.assertNotIn("jeton-id", json.dumps(session, default=str))
        self.assertNotIn("acces", json.dumps(self.client.get("/api/auth/me/").json()))

    def test_logout_requires_csrf_when_logged_in(self):
        client = Client(enforce_csrf_checks=True)
        self.login_as(client=client)
        self.assertEqual(client.post("/api/auth/logout/").status_code, 403)
        self.assertTrue(client.get("/api/auth/me/").json()["authenticated"])
        token = client.cookies["csrftoken"].value
        response = client.post("/api/auth/logout/", HTTP_X_CSRFTOKEN=token)
        self.assertEqual(response.status_code, 200)
        self.assertFalse(client.get("/api/auth/me/").json()["authenticated"])

    def test_me_sets_csrf_cookie(self):
        response = self.client.get("/api/auth/me/")
        self.assertIn("csrftoken", response.cookies)
        self.assertEqual(response.json(), {"configured": True, "authenticated": False})


@mock.patch.dict("os.environ", NO_GOOGLE, clear=False)
class GoogleNotConfiguredTests(TestCase):
    def test_site_works_without_google_settings(self):
        self.assertEqual(self.client.get("/api/auth/me/").json(), {"configured": False, "authenticated": False})
        response = self.client.get("/api/auth/google/start/")
        self.assertEqual(response["Location"], "/newpage?error=google_not_configured")
        response = self.client.get("/api/auth/google/callback/", {"state": "x", "code": "c"})
        self.assertEqual(response["Location"], "/newpage?error=google_not_configured")
        self.assertEqual(self.client.get("/api/profile/").status_code, 200)


@mock.patch.dict("os.environ", ENV, clear=False)
class ProfilePerAccountTests(TestCase):
    """Couleurs et mode : un profil par compte, distinct de celui du site ; CSRF exigé avec une session."""

    def logged_client(self, claims):
        client = Client(enforce_csrf_checks=True)
        client.get("/api/auth/google/start/")
        state = client.session[SESSION_KEY]["state"]
        with fake_fetch_token(), verified(claims):
            client.get("/api/auth/google/callback/", {"state": state, "code": "c"})
        client.get("/api/auth/me/")
        return client, client.cookies["csrftoken"].value

    def put(self, client, url, data, token=None):
        headers = {"HTTP_X_CSRFTOKEN": token} if token else {}
        return client.put(url, json.dumps(data), content_type="application/json", **headers)

    def test_profiles_are_isolated(self):
        alice, alice_token = self.logged_client(CLAIMS)
        bob, bob_token = self.logged_client({**CLAIMS, "sub": "999", "email": "bob@gmail.com", "name": "Bob"})
        visitor = Client(enforce_csrf_checks=True)

        self.assertEqual(self.put(alice, "/api/profile/asset-colors/", {"asset_colors": {"crypto": "#e52592"}}, alice_token).status_code, 200)
        self.assertEqual(self.put(alice, "/api/profile/", {"theme": "dark"}, alice_token).status_code, 200)
        self.assertEqual(self.put(bob, "/api/profile/", {"theme": "light"}, bob_token).status_code, 200)

        self.assertEqual(alice.get("/api/profile/").json()["asset_colors"], {"crypto": "#e52592"})
        self.assertEqual(alice.get("/api/profile/").json()["theme"], "dark")
        self.assertEqual(bob.get("/api/profile/").json()["asset_colors"], {})
        self.assertEqual(bob.get("/api/profile/").json()["theme"], "light")
        site = visitor.get("/api/profile/").json()
        self.assertEqual(site["asset_colors"], {})
        self.assertEqual(site["theme"], "")

    def test_csrf_required_with_session(self):
        alice, token = self.logged_client(CLAIMS)
        self.assertEqual(self.put(alice, "/api/profile/", {"theme": "dark"}).status_code, 403)
        self.assertEqual(self.put(alice, "/api/profile/asset-colors/", {"asset_colors": {}}).status_code, 403)
        self.assertEqual(alice.put("/api/sheet-config/tabs/", json.dumps({"sync_tabs": "portfolio"}), content_type="application/json").status_code, 403)
        self.assertEqual(self.put(alice, "/api/profile/", {"theme": "dark"}, token).status_code, 200)

    def test_visitor_without_session_needs_no_csrf(self):
        """Sans connexion, l'API reste utilisable comme avant (pas de session, donc pas de jeton)."""
        visitor = Client(enforce_csrf_checks=True)
        response = self.put(visitor, "/api/profile/asset-colors/", {"asset_colors": {"fiat": "#1e8e3e"}})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(Profile.site_profile().asset_colors, {"fiat": "#1e8e3e"})

    def test_invalid_theme(self):
        alice, token = self.logged_client(CLAIMS)
        response = self.put(alice, "/api/profile/", {"theme": "violet"}, token)
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["code"], "invalid_theme")
