import os

from django.core.cache import cache
from django.http import JsonResponse
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny

from . import config
from .currencies import HISTORY_TABLE, merged_rows
from .projection import projected_rows
from fx.rates import ISO_CODES
from .models import SheetTable
from profiles.views import current_profile
from .errors import error_response
from .services import SheetError, open_spreadsheet, worksheet_titles
from .sync import DEFAULT_TABS, configured_tabs, sync_sheets

# Délai minimal entre deux synchronisations de la même table (secondes)
SYNC_COOLDOWN = int(os.getenv("SYNC_COOLDOWN_SECONDS", "10"))


def _sort_key(table: SheetTable, order=None):
    """Ordre des onglets : celui de la liste de synchronisation d'abord, puis les autres par nom."""
    order = order if order is not None else DEFAULT_TABS
    if table.name in order:
        return (0, order.index(table.name), table.name)
    return (1, 0, table.name)


def _owner_key(owner):
    """Verrou de synchronisation : un par propriétaire (site ou compte)."""
    return "site" if owner is None else f"user-{owner.pk}"


def _iso(value):
    return value.isoformat() if value else None


@api_view(["GET"])
def table_list(request):
    """GET /api/data/ : liste des tables recopiées en base (celles du compte connecté, sinon celles du site)."""
    owner = config.request_owner(request)
    order = configured_tabs(owner)
    tables = sorted(SheetTable.objects.filter(user=owner), key=lambda table: _sort_key(table, order))
    return JsonResponse(
        [
            {"name": t.name, "row_count": t.row_count, "synced_at": _iso(t.synced_at)}
            for t in tables
        ],
        safe=False,
    )


@api_view(["GET"])
def table_detail(request, name):
    """GET /api/data/<onglet>/ : colonnes (dans l'ordre) et lignes d'une table (du compte connecté, sinon du site)."""
    try:
        table = SheetTable.objects.get(user=config.request_owner(request), name=name)
    except SheetTable.DoesNotExist:
        return error_response(
            f"Table '{name}' introuvable en base. Lance la synchronisation : python manage.py sync_sheets",
            "table_not_found",
            404,
            {"name": name},
        )

    # Valeurs de la feuille + ce que le site calcule avec les taux BCE (googlesheet/currencies.py) :
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
        }
    )


@api_view(["POST"])
@permission_classes([AllowAny])
def table_sync(request, name):
    """
    POST /api/data/<onglet>/sync/ : relit l'onglet dans Google Sheets et met la base à jour.
    Seuls les onglets de la liste de synchronisation sont acceptés.
    """
    try:
        owner = config.owner_for_change(request)
    except config.ScopeMismatch as exc:
        return error_response(str(exc), exc.code, exc.status)
    if name not in configured_tabs(owner):
        return error_response(f"Onglet '{name}' non synchronisable", "tab_not_syncable", 404, {"name": name})

    lock_key = f"sheet-sync-lock:{_owner_key(owner)}:{name}"
    if not cache.add(lock_key, 1, SYNC_COOLDOWN):
        return error_response(
            f"Synchronisation déjà faite à l'instant, réessaie dans {SYNC_COOLDOWN} secondes.",
            "sync_too_soon",
            429,
            {"seconds": SYNC_COOLDOWN},
        )

    try:
        result = sync_sheets(config.doc_name(owner), tabs=[name], owner=owner)[0]
    except SheetError as exc:
        cache.delete(lock_key)
        return error_response(str(exc), exc.code, exc.status, exc.params)

    if not result.ok:
        cache.delete(lock_key)
        return error_response(result.message or "Synchronisation impossible", result.code or "sync_failed", 502, result.params)

    return JsonResponse({"name": name, "row_count": result.rows, "columns": result.columns})


@api_view(["POST"])
@permission_classes([AllowAny])
def sync_all(request):
    """
    POST /api/data/sync/ : relit tous les onglets de la liste de synchronisation et met la base à jour.
    Un onglet en erreur garde ses anciennes données et n'empêche pas les autres.
    200 si au moins un onglet a été enregistré, 502 si aucun.
    """
    try:
        owner = config.owner_for_change(request)
    except config.ScopeMismatch as exc:
        return error_response(str(exc), exc.code, exc.status)
    lock_key = f"sheet-sync-lock:{_owner_key(owner)}:__all__"
    if not cache.add(lock_key, 1, SYNC_COOLDOWN):
        return error_response(
            f"Synchronisation déjà faite à l'instant, réessaie dans {SYNC_COOLDOWN} secondes.",
            "sync_too_soon",
            429,
            {"seconds": SYNC_COOLDOWN},
        )

    try:
        results = sync_sheets(config.doc_name(owner), owner=owner)
    except SheetError as exc:
        cache.delete(lock_key)
        return error_response(str(exc), exc.code, exc.status, exc.params)

    tabs = [
        {"name": r.tab, "ok": r.ok, "row_count": r.rows, "message": r.message, "code": r.code, "params": r.params}
        for r in results
    ]
    saved = sum(1 for r in results if r.ok)
    if not saved:
        cache.delete(lock_key)
        detail = " ; ".join(f"{t['name']} : {t['message'] or 'erreur'}" for t in tabs)
        return error_response(f"Aucun onglet n'a pu être actualisé ({detail})", "no_tab_saved", 502, tabs=tabs)

    # removed : tables d'un autre document retirées (la feuille a changé sur la page GoogleSheet)
    return JsonResponse(
        {
            "tabs": tabs,
            "saved": saved,
            "failed": len(tabs) - saved,
            "removed": getattr(results, "removed", []),
            "fx": getattr(results, "fx", {}),  # taux BCE : date du dernier taux, erreur éventuelle (fx_unreachable…)
        }
    )


@api_view(["GET", "PUT", "DELETE"])
@permission_classes([AllowAny])
def sheet_config(request):
    """
    /api/sheet-config/ : paramètres d'accès au Google Sheet (page GoogleSheet).

    GET    -> valeurs en vigueur (enregistrées, sinon celles du .env) et valeurs du .env.
              La clé privée n'est jamais renvoyée : seulement private_key_set (true/false).
    PUT    -> enregistre les valeurs saisies. Clé privée vide = clé en vigueur conservée.
              400 avec {"error", "code", "fields": {champ: message}, "field_codes": {champ: code}} si la saisie est incomplète.
    DELETE -> efface les valeurs saisies : le .env s'applique de nouveau (site), ou plus rien (compte).
    Compte connecté : sa propre configuration, sans repli sur le .env du site.
    """
    try:
        owner = config.request_owner(request) if request.method == "GET" else config.owner_for_change(request)
    except config.ScopeMismatch as exc:
        return error_response(str(exc), exc.code, exc.status)
    if request.method == "PUT":
        if not isinstance(request.data, dict):
            return error_response("Corps JSON attendu", "invalid_json", 400)
        try:
            config.save(request.data, owner)
        except config.ConfigInvalid as exc:
            return error_response("Formulaire incomplet", "form_incomplete", 400, fields=exc.errors, field_codes=exc.codes)
    elif request.method == "DELETE":
        config.reset(owner)
    return JsonResponse(config.public_view(owner))


@api_view(["GET", "PUT"])
@permission_classes([AllowAny])
def sheet_tabs(request):
    """
    /api/sheet-config/tabs/ : onglets du document (section Onglet de la page GoogleSheet).

    GET -> onglets lus dans le document, pour les proposer. Fonctionne dans les deux modes (compte de service ou lien public).
    PUT -> {"sync_tabs": "portfolio, budget"} : enregistre seulement la liste des onglets à synchroniser,
           renvoie les paramètres comme GET /api/sheet-config/. 400 sync_tabs_required si la liste est vide.
    """
    try:
        owner = config.request_owner(request) if request.method == "GET" else config.owner_for_change(request)
    except config.ScopeMismatch as exc:
        return error_response(str(exc), exc.code, exc.status)
    if request.method == "PUT":
        if not isinstance(request.data, dict):
            return error_response("Corps JSON attendu", "invalid_json", 400)
        try:
            config.save_tabs(request.data.get("sync_tabs"), owner)
        except config.ConfigInvalid as exc:
            return error_response("Formulaire incomplet", "form_incomplete", 400, fields=exc.errors, field_codes=exc.codes)
        return JsonResponse(config.public_view(owner))
    try:
        spreadsheet = open_spreadsheet(config.doc_name(owner), owner)
        tabs = worksheet_titles(spreadsheet)
    except SheetError as exc:
        return error_response(str(exc), exc.code, exc.status, exc.params)
    return JsonResponse({"mode": config.access_mode(owner=owner), "tabs": tabs, "selected": config.sync_tabs(owner)})
