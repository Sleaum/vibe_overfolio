"""
GET /api/data/<onglet>/ : les lignes d'un onglet copiées par googlesheet, avec ce que le site calcule à partir
d'elles (devise d'affichage, devises de history, mois prochain, total de la veille). Liste et synchronisation des
onglets restent dans googlesheet/data_views.py, sous la même adresse /api/data/.
"""
from django.http import JsonResponse
from rest_framework.decorators import api_view

from core.errors import error_response
from fx.rates import ISO_CODES
from googlesheet.data_views import with_owner
from googlesheet.models import SheetTable
from profiles.services import current_profile

from .currencies import HISTORY_TABLE, merged_rows
from .daily import previous_day
from .projection import projected_rows


def _iso(value):
    return value.isoformat() if value else None


@api_view(["GET"])
@with_owner
def table_detail(request, owner, name):
    """GET /api/data/<onglet>/ : colonnes (dans l'ordre) et lignes d'une table (du compte connecté, sinon du site)."""
    try:
        table = SheetTable.objects.get(user=owner, name=name)
    except SheetTable.DoesNotExist:
        return error_response(
            f"Table '{name}' introuvable en base. Lance la synchronisation : python manage.py sync_sheets",
            "table_not_found",
            404,
            {"name": name},
        )

    # Valeurs de la feuille + ce que le site calcule avec les taux BCE (wealth/currencies.py) :
    # montants convertis en euros, et devises choisies sur le profil (graphique Patrimoine par devise)
    # ?currency=THB : montants dans la devise d'affichage choisie dans l'en-tête (pages Charts et Simulation)
    display = (request.GET.get("currency") or "EUR").strip().upper()
    if display not in ISO_CODES:
        return error_response("Devise non valable.", "invalid_currency", 400)
    # ?projection=1 (graphiques de Flow et Envelopes) : history reçoit en plus le mois prochain, tiré de portfolio (projection.py)
    extra, projection = [], None
    if table.name == HISTORY_TABLE and request.GET.get("projection") == "1":
        extra, projection = projected_rows(table)
    selected = current_profile(request).chart_currencies or []
    columns, rows, added, available, unconverted = merged_rows(table, selected, display, extra=extra)
    return JsonResponse(
        {
            "name": table.name,
            "columns": columns,
            "header_row": table.header_row,
            "row_count": table.row_count,
            "synced_at": _iso(table.synced_at),
            "rows": rows,
            "currency": table.currency,  # devise des montants dans la feuille ; convertis en euros si ce n'est pas EUR
            "display_currency": display,  # devise des colonnes de montants de cette réponse
            "unconverted_rows": unconverted,  # lignes dont les montants sont vidés : pas de taux BCE pour ce jour
            "computed_columns": added,  # colonnes de devises calculées par le site
            "currencies_available": available,  # devises proposées dans « Patrimoine par devise »
            "rates_applied_at": _iso(table.rates_applied_at),
            "projection": projection,  # mois prochain ajouté : {date, rows, unconverted, source_date}, sinon null
            # portfolio : total du jour gardé le plus récent avant cette synchronisation (variation « 24h » de Snapshot) :
            # {date, assets, liabilities} dans la devise d'affichage, sinon null
            "previous_day": previous_day(table, display),
        }
    )
