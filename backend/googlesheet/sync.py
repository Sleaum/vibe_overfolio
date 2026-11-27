"""Recopie des onglets du Google Sheet dans la base de données (PostgreSQL)."""
import logging
from dataclasses import dataclass, field
from typing import Dict, List, Optional

from django.db import transaction
from django.utils import timezone

from . import config
from .models import SheetRow, SheetTable
from .services import SheetError, detect_currency, open_spreadsheet, parse_values, read_worksheet_values
from .signals import tables_synced

logger = logging.getLogger(__name__)


@dataclass
class TabResult:
    tab: str
    ok: bool = False
    saved: bool = False
    header_row: int = 0
    columns: List[str] = field(default_factory=list)
    rows: int = 0
    currency: str = "EUR"  # devise des montants, lue au-dessus de l'en-tête (case M1 de portfolio)
    message: str = ""
    code: str = ""  # même erreur que message, pour le site (voir core/errors.py)
    params: dict = field(default_factory=dict)


class SyncResults(list):
    """
    Résultats par onglet (une liste de TabResult), plus `removed` : tables d'un autre document retirées, et
    `computed` : ce que les receveurs de tables_synced ont renvoyé (wealth : {"fx": taux BCE et devises recalculées}).
    """

    removed: List[str]
    computed: dict

    def __init__(self, *args):
        super().__init__(*args)
        self.removed = []
        self.computed = {}


def document_source(settings: config.SheetSettings) -> str:
    """Clé du document configuré : son identifiant, sinon « nom:<nom> » (recherche par nom)."""
    return settings.sheet_id or f"nom:{settings.doc_name}"


@transaction.atomic
def _save_table(
    tab: str, header_row: int, columns: List[str], rows: List[dict], source: str = "", owner=None, currency: str = "EUR"
) -> None:
    """Remplace d'un seul bloc le contenu d'un onglet (de ce propriétaire) : tout est écrit, ou rien."""
    table, _ = SheetTable.objects.update_or_create(
        user=owner,
        name=tab,
        defaults={
            "source": source,
            "currency": currency,
            "header_row": header_row,
            "columns": columns,
            "row_count": len(rows),
            "synced_at": timezone.now(),
        },
    )
    table.rows.all().delete()
    SheetRow.objects.bulk_create(
        [SheetRow(table=table, position=i, data=row) for i, row in enumerate(rows)],
        batch_size=500,
    )


def sync_sheets(
    settings: config.SheetSettings,
    tabs: Optional[List[str]] = None,
    header_rows: Optional[Dict[str, int]] = None,
    dry_run: bool = False,
    allow_empty: bool = False,
) -> List[TabResult]:
    """
    Lit chaque onglet dans Google Sheets puis le recopie en base.

    - Un onglet en erreur n'empêche pas les autres ; ses anciennes données sont conservées.
    - Un onglet qui ne renvoie aucune ligne n'écrase pas des données existantes
      (sauf allow_empty=True) : cela évite de vider la base si la feuille est vide
      ou si la ligne d'en-tête est mal détectée.
    - Lève SheetError si le document lui-même est inaccessible (rien n'est alors modifié en base).
    - Les tables venues d'un autre document (feuille changée sur la page GoogleSheet), ou d'origine inconnue
      et non relues ici, sont retirées : la base ne garde que des données du document configuré.
    - settings : configuration lue une fois (config.load_settings). Son propriétaire (`settings.owner` : None pour
      le site, sinon le compte connecté) décide des données écrites : jamais celles d'un autre.
    - Ensuite, le signal tables_synced laisse les autres apps recalculer (wealth : devises, total du jour).
    """
    owner = settings.owner
    tabs = tabs or settings.tabs
    header_rows = header_rows or {}
    spreadsheet = open_spreadsheet(settings)
    source = document_source(settings)

    results = SyncResults()
    for tab in tabs:
        result = TabResult(tab=tab)
        results.append(result)

        try:
            values = read_worksheet_values(spreadsheet, tab)
            header_row, columns, rows = parse_values(values, header_rows.get(tab))
        except SheetError as exc:
            result.message, result.code, result.params = str(exc), exc.code, exc.params
            continue

        result.header_row, result.columns, result.rows = header_row, columns, len(rows)
        result.currency = detect_currency(values, header_row, columns)

        if not rows and not allow_empty and SheetTable.objects.filter(user=owner, name=tab, row_count__gt=0).exists():
            result.message = "aucune ligne lue : données existantes conservées (--allow-empty pour forcer)"
            result.code = "empty_kept"
            continue

        if dry_run:
            result.ok = True
            result.message = "simulation : rien n'a été écrit"
            result.code = "dry_run"
            continue

        try:
            _save_table(tab, header_row, columns, rows, source, owner, result.currency)
        except Exception as exc:
            logger.exception("Écriture en base impossible pour l'onglet %s", tab)
            result.message = f"erreur base de données : {exc}"
            result.code, result.params = "database_error", {"detail": str(exc)}
            continue

        result.ok = True
        result.saved = True

    if not dry_run:
        results.removed = _remove_other_documents(source, owner)
        saved = [result.tab for result in results if result.saved]
        for _, computed in tables_synced.send(sender=SheetTable, owner=owner, tabs=saved):
            results.computed.update(computed or {})
    return results


def _remove_other_documents(source: str, owner=None) -> List[str]:
    """Retire les tables de ce propriétaire qui ne viennent pas du document configuré ; renvoie leurs noms."""
    others = SheetTable.objects.filter(user=owner).exclude(source=source)
    names = sorted(others.values_list("name", flat=True))
    if names:
        logger.info("Tables d'un autre document retirées : %s", ", ".join(names))
        others.delete()  # les lignes suivent (clé étrangère en cascade)
    return names
