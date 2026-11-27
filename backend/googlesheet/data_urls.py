from django.urls import path

from . import data_views

# GET /api/data/<onglet>/ (lignes et calculs) est dans wealth/urls.py, monté juste après, sous la même adresse.
urlpatterns = [
    path("", data_views.table_list),
    path("sync/", data_views.sync_all),  # tous les onglets (bouton « Tout actualiser »)
    path("<str:name>/sync/", data_views.table_sync),
]
