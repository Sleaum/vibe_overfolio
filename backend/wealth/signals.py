"""Ce que wealth recalcule après chaque synchronisation (signal googlesheet.signals.tables_synced)."""
import logging

from .currencies import refresh_currencies
from .daily import PORTFOLIO_TABLE, record_portfolio_day

logger = logging.getLogger(__name__)


def after_sync(sender, owner=None, tabs=(), **kwargs):
    """Devises recalculées pour les onglets enregistrés, puis total du jour si portfolio en fait partie."""
    fx = refresh_currencies(owner, tabs)
    if PORTFOLIO_TABLE in tabs:
        try:
            record_portfolio_day(owner)  # variation « 24h » de Snapshot : un raté ne doit pas faire échouer la synchro
        except Exception:
            logger.exception("Total du jour de portfolio non enregistré")
    return {"fx": fx}
