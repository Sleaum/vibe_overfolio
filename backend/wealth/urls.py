from django.urls import path

from . import views

# Monté sous /api/data/ après googlesheet.data_urls, qui garde la liste et les adresses de synchronisation.
urlpatterns = [
    path("<str:name>/", views.table_detail),
]
