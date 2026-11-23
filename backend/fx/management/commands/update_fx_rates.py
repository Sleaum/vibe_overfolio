from django.core.management.base import BaseCommand

from fx.ecb import update_rates
from googlesheet.sync import refresh_currencies


class Command(BaseCommand):
    help = (
        "Ajoute les taux de change manquants (BCE). Avec --recompute, recalcule aussi les devises de toutes les "
        "tables concernées (history, et celles qui ne sont pas en euros), pour le site et chaque compte."
    )

    def add_arguments(self, parser):
        parser.add_argument("--force", action="store_true", help="interroge la BCE même si les taux semblent à jour")
        parser.add_argument("--recompute", action="store_true", help="recalcule les devises de toutes les tables")

    def handle(self, *args, **options):
        update = update_rates(force=options["force"])
        if update.error:
            self.stderr.write(self.style.WARNING(f"BCE : {update.error} (les taux déjà en base restent utilisés)"))
        else:
            self.stdout.write(f"Taux ajoutés : {update.added} ; dernier taux : {update.latest or 'aucun'}")
        if options["recompute"]:
            result = refresh_currencies("all")
            for name, stats in result.get("tables", {}).items():
                self.stdout.write(f"{name} : {stats['rows']} lignes, {stats['converted']} converties, {stats['missing_rate']} sans taux")
