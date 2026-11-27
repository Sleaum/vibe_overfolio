from io import StringIO
from unittest import mock

from cryptography.fernet import Fernet
from django.contrib.auth import get_user_model
from django.core.management import CommandError, call_command
from django.test import TestCase, override_settings

from accounts.models import GoogleAccount
from googlesheet.models import SheetConfig

from . import crypto

K1 = Fernet.generate_key().decode()
K2 = Fernet.generate_key().decode()


def with_key(value):
    return mock.patch.dict("os.environ", {"FIELD_ENCRYPTION_KEY": value})


class CryptoTests(TestCase):
    def test_without_key_a_key_derived_from_secret_key_is_used(self):
        with with_key(""):
            self.assertFalse(crypto.has_explicit_key())
            token = crypto.encrypt("secret")
            self.assertNotIn("secret", token)
            self.assertEqual(crypto.decrypt(token), "secret")
        with self.assertRaises(Exception):
            Fernet(K1.encode()).decrypt(token.encode())

    def test_field_encryption_key_comes_first(self):
        with with_key(K1):
            self.assertTrue(crypto.has_explicit_key())
            token = crypto.encrypt("secret")
        self.assertEqual(Fernet(K1.encode()).decrypt(token.encode()).decode(), "secret")

    def test_adding_a_key_later_keeps_old_values_readable(self):
        with with_key(""):
            token = crypto.encrypt("secret")
        with with_key(K1):
            self.assertEqual(crypto.decrypt(token), "secret")

    def test_new_key_first_then_old_key_during_a_rotation(self):
        with with_key(K1):
            old = crypto.encrypt("secret")
        with with_key(f"{K2},{K1}"):
            self.assertEqual(crypto.decrypt(old), "secret")
            rotated = crypto.rotate(old)
        self.assertEqual(Fernet(K2.encode()).decrypt(rotated.encode()).decode(), "secret")
        with with_key(K2):
            self.assertEqual(crypto.decrypt(rotated), "secret")
            with self.assertRaises(crypto.DecryptError):
                crypto.decrypt(old)

    def test_changed_secret_key_needs_the_old_one_in_fallbacks(self):
        with with_key(""), override_settings(SECRET_KEY="ancienne"):
            token = crypto.encrypt("secret")
        with with_key(""), override_settings(SECRET_KEY="nouvelle", SECRET_KEY_FALLBACKS=[]):
            with self.assertRaises(crypto.DecryptError):
                crypto.decrypt(token)
        with with_key(""), override_settings(SECRET_KEY="nouvelle", SECRET_KEY_FALLBACKS=["ancienne"]):
            self.assertEqual(crypto.decrypt(token), "secret")

    def test_invalid_field_encryption_key_is_ignored(self):
        with with_key("pas-une-cle"), self.assertLogs("core.crypto", level="ERROR"):
            self.assertFalse(crypto.has_explicit_key())
        with with_key("pas-une-cle"), self.assertLogs("core.crypto", level="ERROR"):
            self.assertEqual(crypto.decrypt(crypto.encrypt("secret")), "secret")


class RotateCommandTests(TestCase):
    def setUp(self):
        with with_key(K1):
            self.config = SheetConfig.objects.create(service_account=crypto.encrypt('{"private_key": "k"}'))
            user = get_user_model().objects.create_user("alice")
            self.account = GoogleAccount.objects.create(user=user, sub="sub-alice", drive_refresh_token=crypto.encrypt("jeton"))

    def run_command(self, *args):
        out = StringIO()
        call_command("rotate_encryption_key", *args, stdout=out)
        return out.getvalue()

    def readable_with(self, key, row, field):
        row.refresh_from_db()
        try:
            Fernet(key.encode()).decrypt(getattr(row, field).encode())
            return True
        except Exception:
            return False

    def test_everything_is_encrypted_again_with_the_first_key(self):
        with with_key(f"{K2},{K1}"):
            output = self.run_command()
        self.assertIn("Comptes de service : 1 rechiffrés, 0 illisibles.", output)
        self.assertIn("Jetons du mode 3 : 1 rechiffrés, 0 illisibles.", output)
        self.assertTrue(self.readable_with(K2, self.config, "service_account"))
        self.assertTrue(self.readable_with(K2, self.account, "drive_refresh_token"))
        self.assertFalse(self.readable_with(K1, self.config, "service_account"))

    def test_dry_run_writes_nothing(self):
        with with_key(f"{K2},{K1}"):
            output = self.run_command("--dry-run")
        self.assertIn("1 à rechiffrer", output)
        self.assertTrue(self.readable_with(K1, self.config, "service_account"))

    def test_unreadable_values_are_left_untouched_and_reported(self):
        before = SheetConfig.objects.get().service_account
        with with_key(K2), self.assertRaises(CommandError) as caught:
            self.run_command()
        self.assertIn("2 valeur(s) illisible(s)", str(caught.exception))
        self.assertEqual(SheetConfig.objects.get().service_account, before)

    def test_without_field_encryption_key_drive_tokens_are_left_alone(self):
        SheetConfig.objects.all().delete()
        with with_key(""):
            output = self.run_command()
        self.assertIn("Jetons du mode 3 laissés tels quels", output)
        self.assertTrue(self.readable_with(K1, self.account, "drive_refresh_token"))
