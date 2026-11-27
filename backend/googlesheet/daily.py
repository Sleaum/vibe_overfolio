"""
Total de portfolio gardé chaque jour (modèle PortfolioDay), pour la variation « 24h » de la page Snapshot.

- record_portfolio_day : après une synchronisation qui a enregistré portfolio, garde son total du jour (le dernier
  de la journée remplace le précédent).
- previous_day : le relevé du jour le plus récent avant celui de la dernière synchronisation de portfolio, converti
  dans la devise d'affichage au taux de son jour ; envoyé avec GET /api/data/portfolio/ (champ `previous_day`).
"""
import datetime
from typing import Optional

from django.utils import timezone

from .currencies import _round
from .models import PortfolioDay, SheetTable
from .schema import ASSETS, LIABILITIES, normalize_rows, sheet_column
from fx.rates import RateBook

PORTFOLIO_TABLE = "portfolio"


def portfolio_totals(table: SheetTable):
    """(actifs ≥ 0, dettes ≤ 0) de portfolio, dans la devise de la feuille ; comme les repères du site (lib/amounts.js)."""
    rows = normalize_rows(PORTFOLIO_TABLE, table.columns or [], table.rows.values_list("data", flat=True)).rows
    assets = sum(max(row.get(ASSETS) or 0, 0) for row in rows)
    debts = sum(min(row.get(LIABILITIES) or 0, 0) for row in rows)
    return float(assets), float(debts)


def record_portfolio_day(owner=None, day: Optional[datetime.date] = None) -> Optional[PortfolioDay]:
    """Garde le total de portfolio de ce propriétaire pour le jour `day` (aujourd'hui par défaut)."""
    table = SheetTable.objects.filter(user=owner, name=PORTFOLIO_TABLE).first()
    if table is None or sheet_column(PORTFOLIO_TABLE, table.columns or [], ASSETS) is None:
        return None
    assets, debts = portfolio_totals(table)
    record, _ = PortfolioDay.objects.update_or_create(
        user=owner,
        day=day or timezone.localdate(),
        defaults={
            "assets": _round(assets),
            "liabilities": _round(debts),
            "currency": (table.currency or "EUR").upper(),
            "source": table.source,
        },
    )
    return record


def previous_day(table: SheetTable, display: str = "EUR") -> Optional[dict]:
    """
    {date, assets, liabilities} du dernier jour gardé avant celui de la synchronisation de portfolio, dans la devise
    `display` ; None s'il n'y en a pas (le premier jour) ou s'il manque le taux de change de ce jour-là.
    """
    if table.name != PORTFOLIO_TABLE or table.synced_at is None:
        return None
    synced_day = timezone.localdate(table.synced_at)
    record = (
        PortfolioDay.objects.filter(user=table.user_id, source=table.source, day__lt=synced_day)
        .order_by("-day")
        .first()
    )
    if record is None:
        return None
    display = (display or "EUR").upper()
    factor = 1.0
    if record.currency != display:
        book = RateBook(since=record.day, codes={record.currency, display})
        source_rate, display_rate = book.rate(record.currency, record.day), book.rate(display, record.day)
        if not source_rate or not display_rate:
            return None  # pas de taux ce jour-là : pas de variation plutôt qu'une variation fausse
        factor = display_rate / source_rate
    return {
        "date": record.day.isoformat(),
        "assets": _round(record.assets * factor),
        "liabilities": _round(record.liabilities * factor),
    }
