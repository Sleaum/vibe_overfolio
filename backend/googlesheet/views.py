import hashlib
import logging
import os

from django.core.cache import cache
from django.http import JsonResponse
from rest_framework.decorators import api_view

from .errors import error_response
from .services import SheetError, get_all_rows

logger = logging.getLogger(__name__)

# Durée du cache en secondes (0 pour désactiver). Évite de solliciter l'API Google
# à chaque composant de la page (tableau + 3 graphiques = 4 appels identiques).
CACHE_SECONDS = int(os.getenv("SHEET_CACHE_SECONDS", "60"))


def _allowed_docs() -> set:
    """Liste blanche optionnelle : ALLOWED_SHEET_DOCS=overfolio,autre_feuille"""
    raw = os.getenv("ALLOWED_SHEET_DOCS", "")
    return {name.strip() for name in raw.split(",") if name.strip()}


@api_view(["GET"])
def googlesheet(request):
    """
    GET /api/sheet?doc_name=<nom>[&sheet_name=<onglet>][&header_row=<n>][&refresh=1]
    Renvoie un tableau JSON : une ligne de la feuille = un objet {colonne: valeur}.
    """
    doc_name = (request.GET.get("doc_name") or "").strip()
    sheet_name = (request.GET.get("sheet_name") or "").strip() or None
    refresh = request.GET.get("refresh") == "1"

    header_row = None
    raw_header_row = (request.GET.get("header_row") or "").strip()
    if raw_header_row:
        if not raw_header_row.isdigit() or int(raw_header_row) < 1:
            return error_response("header_row doit être un entier supérieur ou égal à 1", "header_row_invalid", 400)
        header_row = int(raw_header_row)

    if not doc_name:
        return error_response("Paramètre obligatoire manquant : doc_name", "doc_name_missing", 400)

    allowed = _allowed_docs()
    if allowed and doc_name not in allowed:
        return error_response("Document non autorisé", "doc_not_allowed", 403)

    raw_key = f"{doc_name}\x00{sheet_name or ''}\x00{header_row or ''}"
    cache_key = "googlesheet:" + hashlib.sha1(raw_key.encode("utf-8")).hexdigest()

    if not refresh:
        cached = cache.get(cache_key)
        if cached is not None:
            return JsonResponse(cached, safe=False)

    try:
        data = get_all_rows(doc_name, sheet_name, header_row)
    except SheetError as exc:
        return error_response(str(exc), exc.code, exc.status, exc.params)
    except Exception:
        logger.exception("Erreur inattendue pendant la lecture de la feuille")
        return error_response("Erreur interne pendant la lecture de la feuille", "internal_error", 500)

    cache.set(cache_key, data, CACHE_SECONDS)
    return JsonResponse(data, safe=False)
