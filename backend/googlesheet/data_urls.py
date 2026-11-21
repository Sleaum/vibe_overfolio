from django.urls import path

from . import data_views

urlpatterns = [
    path("", data_views.table_list),
    path("sync/", data_views.sync_all),  # tous les onglets (bouton « Tout actualiser »)
    path("<str:name>/sync/", data_views.table_sync),
    path("<str:name>/", data_views.table_detail),
]
