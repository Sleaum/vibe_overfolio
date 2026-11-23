from django.urls import path

from . import views

urlpatterns = [
    path("google/start/", views.google_start),
    path("google/callback/", views.google_callback),
    path("me/", views.me),
    path("logout/", views.logout_view),
]
