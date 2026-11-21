import os

from django.core.cache import cache
from django.http import JsonResponse
from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.permissions import AllowAny

from . import config
from .models import SheetTable
from .services import SheetError
from .sync import DEFAULT_TABS, configured_tabs, sync_sheets

# Délai minimal entre deux synchronisations de la même table (secondes)
SYNC_COOLDOWN = int(os.getenv("SYNC_COOLDOWN_SECONDS", "10"))


def _sort_key(table: SheetTable, order=None):
    """Ordre des onglets : celui de la liste de synchronisation d'abord, puis les autres par nom."""
    order = order if order is not None else DEFAULT_TABS
    if table.name in order:
        return (0, order.index(table.name), table.name)
    return (1, 0, table.name)


def _iso(value):
    return value.isoformat() if value else None


@api_view(["GET"])
def table_list(request):
    """GET /api/data/ : liste des tables recopiées en base."""
    order = configured_tabs()
    tables = sorted(SheetTable.objects.all(), key=lambda table: _sort_key(table, order))
    return JsonResponse(
        [
            {"name": t.name, "row_count": t.row_count, "synced_at": _iso(t.synced_at)}
            for t in tables
        ],
        safe=False,
    )


@api_view(["GET"])
def table_detail(request, name):
    """GET /api/data/<onglet>/ : colonnes (dans l'ordre) et lignes d'une table."""
    try:
        table = SheetTable.objects.get(name=name)
    except SheetTable.DoesNotExist:
        return JsonResponse(
            {
                "error": f"Table '{name}' introuvable en base. "
                "Lance la synchronisation : python manage.py sync_sheets"
            },
            status=404,
        )

    rows = list(table.rows.order_by("position").values_list("data", flat=True))
    return JsonResponse(
        {
            "name": table.name,
            "columns": table.columns,
            "header_row": table.header_row,
            "row_count": table.row_count,
            "synced_at": _iso(table.synced_at),
            "rows": rows,
        }
    )


@api_view(["POST"])
@authentication_classes([])  # pas de session : évite le rejet CSRF si l'admin est connecté
@permission_classes([AllowAny])
def table_sync(request, name):
    """
    POST /api/data/<onglet>/sync/ : relit l'onglet dans Google Sheets et met la base à jour.
    Seuls les onglets de la liste de synchronisation sont acceptés.
    """
    if name not in configured_tabs():
        return JsonResponse({"error": f"Onglet '{name}' non synchronisable"}, status=404)

    lock_key = f"sheet-sync-lock:{name}"
    if not cache.add(lock_key, 1, SYNC_COOLDOWN):
        return JsonResponse(
            {"error": f"Synchronisation déjà faite à l'instant, réessaie dans {SYNC_COOLDOWN} secondes."},
            status=429,
        )

    try:
        result = sync_sheets(config.doc_name(), tabs=[name])[0]
    except SheetError as exc:
        cache.delete(lock_key)
        return JsonResponse({"error": str(exc)}, status=exc.status)

    if not result.ok:
        cache.delete(lock_key)
        return JsonResponse({"error": result.message or "Synchronisation impossible"}, status=502)

    return JsonResponse({"name": name, "row_count": result.rows, "columns": result.columns})


@api_view(["POST"])
@authentication_classes([])  # pas de session : évite le rejet CSRF si l'admin est connecté
@permission_classes([AllowAny])
def sync_all(request):
    """
    POST /api/data/sync/ : relit tous les onglets de la liste de synchronisation et met la base à jour.
    Un onglet en erreur garde ses anciennes données et n'empêche pas les autres.
    200 si au moins un onglet a été enregistré, 502 si aucun.
    """
    lock_key = "sheet-sync-lock:__all__"
    if not cache.add(lock_key, 1, SYNC_COOLDOWN):
        return JsonResponse(
            {"error": f"Synchronisation déjà faite à l'instant, réessaie dans {SYNC_COOLDOWN} secondes."},
            status=429,
        )

    try:
        results = sync_sheets(config.doc_name())
    except SheetError as exc:
        cache.delete(lock_key)
        return JsonResponse({"error": str(exc)}, status=exc.status)

    tabs = [
        {"name": r.tab, "ok": r.ok, "row_count": r.rows, "message": r.message}
        for r in results
    ]
    saved = sum(1 for r in results if r.ok)
    if not saved:
        cache.delete(lock_key)
        detail = " ; ".join(f"{t['name']} : {t['message'] or 'erreur'}" for t in tabs)
        return JsonResponse({"error": f"Aucun onglet n'a pu être actualisé ({detail})", "tabs": tabs}, status=502)

    return JsonResponse({"tabs": tabs, "saved": saved, "failed": len(tabs) - saved})


@api_view(["GET", "PUT", "DELETE"])
@authentication_classes([])  # pas de session : évite le rejet CSRF si l'admin est connecté
@permission_classes([AllowAny])
def sheet_config(request):
    """
    /api/sheet-config/ : paramètres d'accès au Google Sheet (page GoogleSheet).

    GET    -> valeurs en vigueur (enregistrées, sinon celles du .env) et valeurs du .env.
              La clé privée n'est jamais renvoyée : seulement private_key_set (true/false).
    PUT    -> enregistre les valeurs saisies. Clé privée vide = clé en vigueur conservée.
              400 avec {"error", "fields": {champ: message}} si la saisie est incomplète.
    DELETE -> efface les valeurs saisies : le .env s'applique de nouveau.
    """
    if request.method == "PUT":
        if not isinstance(request.data, dict):
            return JsonResponse({"error": "Corps JSON attendu"}, status=400)
        try:
            config.save(request.data)
        except config.ConfigInvalid as exc:
            return JsonResponse({"error": "Formulaire incomplet", "fields": exc.errors}, status=400)
    elif request.method == "DELETE":
        config.reset()
    return JsonResponse(config.public_view())
