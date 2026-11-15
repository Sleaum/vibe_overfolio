import os

from django.core.cache import cache
from django.http import JsonResponse
from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.permissions import AllowAny

from .models import SheetTable
from .services import SheetError
from .sync import DEFAULT_TABS, configured_tabs, sync_sheets

# Délai minimal entre deux synchronisations de la même table (secondes)
SYNC_COOLDOWN = int(os.getenv("SYNC_COOLDOWN_SECONDS", "10"))


def _sort_key(table: SheetTable):
    """Ordre des onglets : celui de DEFAULT_TABS d'abord, puis les autres par nom."""
    if table.name in DEFAULT_TABS:
        return (0, DEFAULT_TABS.index(table.name), table.name)
    return (1, 0, table.name)


def _iso(value):
    return value.isoformat() if value else None


@api_view(["GET"])
def table_list(request):
    """GET /api/data/ : liste des tables recopiées en base."""
    tables = sorted(SheetTable.objects.all(), key=_sort_key)
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
        doc_name = os.getenv("GOOGLE_SHEET_DOC_NAME", "overfolio")
        result = sync_sheets(doc_name, tabs=[name])[0]
    except SheetError as exc:
        cache.delete(lock_key)
        return JsonResponse({"error": str(exc)}, status=exc.status)

    if not result.ok:
        cache.delete(lock_key)
        return JsonResponse({"error": result.message or "Synchronisation impossible"}, status=502)

    return JsonResponse({"name": name, "row_count": result.rows, "columns": result.columns})
