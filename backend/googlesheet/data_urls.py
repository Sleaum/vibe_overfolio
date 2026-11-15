from django.urls import path

from . import data_views

urlpatterns = [
    path("", data_views.table_list),
    path("<str:name>/sync/", data_views.table_sync),
    path("<str:name>/", data_views.table_detail),
]
