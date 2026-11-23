from django.urls import path

from . import views

urlpatterns = [
    path("google/start/", views.google_start),
    path("google/callback/", views.google_callback),
    path("google/drive/start/", views.drive_start),
    path("google/drive/revoke/", views.drive_revoke),
    path("google/picker-token/", views.picker_token),
    path("me/", views.me),
    path("logout/", views.logout_view),
]
