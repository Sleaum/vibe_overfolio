from django.urls import path

from . import views

urlpatterns = [
    path("", views.profile_detail),
    path("asset-colors/", views.profile_asset_colors),
]
