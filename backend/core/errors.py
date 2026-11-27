"""
Réponses d'erreur de l'API, toutes de la même forme :

    {"error": "message en français", "code": "code_stable", "params": {...}}

Le site affiche le message dans la langue choisie à partir de `code` et `params` (frontend/src/i18n/*.json,
rubrique apiErrors) ; `error` reste en français pour la ligne de commande et pour un code inconnu du site.
"""

from django.http import JsonResponse


def error_response(message, code, status, params=None, **extra):
    return JsonResponse({"error": message, "code": code, "params": params or {}, **extra}, status=status)
