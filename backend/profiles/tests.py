import json

from django.contrib.auth import get_user_model
from django.test import TestCase

from .models import Profile
from .views import current_profile


class ProfileAssetColorsTests(TestCase):
    url = "/api/profile/"
    colors_url = "/api/profile/asset-colors/"

    def put(self, data):
        return self.client.put(self.colors_url, json.dumps(data), content_type="application/json")

    def test_empty_profile_is_created(self):
        body = self.client.get(self.url).json()
        self.assertEqual(body["asset_colors"], {})
        self.assertEqual(Profile.objects.count(), 1)

    def test_colors_are_saved_and_normalised(self):
        response = self.put({"asset_colors": {"Crypto": "#F9AB00", " fiat ": "#1e8e3e"}})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["asset_colors"], {"crypto": "#f9ab00", "fiat": "#1e8e3e"})
        self.assertEqual(self.client.get(self.url).json()["asset_colors"], {"crypto": "#f9ab00", "fiat": "#1e8e3e"})
        self.assertEqual(Profile.objects.count(), 1)

    def test_empty_object_resets(self):
        self.put({"asset_colors": {"crypto": "#f9ab00"}})
        self.assertEqual(self.put({"asset_colors": {}}).json()["asset_colors"], {})

    def test_invalid_colors_are_refused(self):
        for payload in (
            {"asset_colors": {"crypto": "red"}},
            {"asset_colors": {"crypto": "#f9ab0"}},
            {"asset_colors": {"": "#f9ab00"}},
            {"asset_colors": ["#f9ab00"]},
            {"asset_colors": {"x" * 101: "#f9ab00"}},
            {},
        ):
            response = self.put(payload)
            self.assertEqual(response.status_code, 400, payload)
            self.assertEqual(response.json()["code"], "invalid_asset_colors")

    def test_each_user_has_own_profile(self):
        """Prêt pour les comptes : un utilisateur connecté a son propre profil, distinct de celui du site."""
        user = get_user_model().objects.create_user("alice")
        request = type("Request", (), {"user": user})()
        mine = current_profile(request)
        self.assertEqual(mine.user, user)
        self.assertEqual(current_profile(request).pk, mine.pk)
        site = current_profile(type("Request", (), {"user": None})())
        self.assertIsNone(site.user)
        self.assertNotEqual(site.pk, mine.pk)


class ChartCurrenciesTests(TestCase):
    url = "/api/profile/"

    def put(self, data):
        return self.client.put(self.url, json.dumps(data), content_type="application/json")

    def test_currencies_are_saved_without_touching_theme(self):
        self.put({"theme": "dark"})
        response = self.put({"chart_currencies": ["eur", "THB", "EUR", " usd "]})
        self.assertEqual(response.status_code, 200, response.content)
        body = response.json()
        self.assertEqual(body["chart_currencies"], ["EUR", "THB", "USD"])
        self.assertEqual(body["theme"], "dark")
        self.assertEqual(self.client.get(self.url).json()["chart_currencies"], ["EUR", "THB", "USD"])
        self.assertEqual(self.put({"chart_currencies": []}).json()["chart_currencies"], [])

    def test_invalid_currencies(self):
        for value in ("EUR", ["EURO"], [1], ["E1R"], ["EUR"] * 0 + [f"A{chr(65 + i % 26)}{chr(65 + i // 26)}" for i in range(41)]):
            response = self.put({"chart_currencies": value})
            self.assertEqual((response.status_code, response.json()["code"]), (400, "invalid_currencies"), value)


class DisplayCurrencyTests(TestCase):
    def put(self, body):
        return self.client.put("/api/profile/", json.dumps(body), content_type="application/json")

    def test_display_currency(self):
        self.assertEqual(self.client.get("/api/profile/").json()["display_currency"], "")
        self.put({"theme": "dark"})
        response = self.put({"display_currency": "thb"})
        self.assertEqual(response.status_code, 200)
        self.assertEqual((response.json()["display_currency"], response.json()["theme"]), ("THB", "dark"))  # le mode ne change pas
        self.assertEqual(self.put({"display_currency": ""}).json()["display_currency"], "")  # retour à l'euro
        for value in ("XYZ", "EURO", 12, None):
            response = self.put({"display_currency": value})
            self.assertEqual((response.status_code, response.json()["code"]), (400, "invalid_currency"))
