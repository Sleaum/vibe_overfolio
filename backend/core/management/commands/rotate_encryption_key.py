"""
python manage.py rotate_encryption_key [--dry-run]

Rechiffre les secrets gardés en base avec la première clé (core/crypto.py) : comptes de service de
googlesheet.SheetConfig et jetons du mode 3 de accounts.GoogleAccount. À lancer après avoir mis une nouvelle clé en
tête de FIELD_ENCRYPTION_KEY (ou changé SECRET_KEY en gardant l'ancienne dans SECRET_KEY_FALLBACKS) ; l'ancienne
clé peut ensuite être retirée. Une valeur qu'aucune clé connue ne déchiffre est laissée telle quelle et signalée.
"""
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from accounts.models import GoogleAccount
from core import crypto
from googlesheet.models import SheetConfig


class Command(BaseCommand):
    help = "Rechiffre les secrets en base (comptes de service, jetons du mode 3) avec la première clé de chiffrement."

    def add_arguments(self, parser):
        parser.add_argument("--dry-run", action="store_true", help="Compte ce qui serait rechiffré, sans rien écrire.")

    def handle(self, *args, **options):
        dry_run = options["dry_run"]
        targets = [(SheetConfig, "service_account", "comptes de service")]
        if crypto.has_explicit_key():
            targets.append((GoogleAccount, "drive_refresh_token", "jetons du mode 3"))
        else:
            # Le mode 3 exige FIELD_ENCRYPTION_KEY : sans elle, ses jetons ne sont pas lus, donc pas rechiffrés
            self.stdout.write("Jetons du mode 3 laissés tels quels : FIELD_ENCRYPTION_KEY absente.")

        unreadable = 0
        with transaction.atomic():
            for model, field, label in targets:
                done = failed = 0
                for row in model.objects.exclude(**{field: ""}):
                    try:
                        value = crypto.rotate(getattr(row, field))
                    except crypto.DecryptError:
                        failed += 1
                        continue
                    done += 1
                    if not dry_run:
                        setattr(row, field, value)
                        row.save(update_fields=[field])
                verb = "à rechiffrer" if dry_run else "rechiffrés"
                self.stdout.write(f"{label.capitalize()} : {done} {verb}, {failed} illisibles.")
                unreadable += failed
        if unreadable:
            raise CommandError(
                f"{unreadable} valeur(s) illisible(s) avec les clés connues : laissées telles quelles. "
                "Remets l'ancienne clé (FIELD_ENCRYPTION_KEY ou SECRET_KEY_FALLBACKS) et relance, ou ressaisis-les sur la page."
            )
