from django.contrib import admin
from django.urls import path, include

from googlesheet.data_views import sheet_config, sheet_tabs

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/sheet-config/', sheet_config),
    path('api/sheet-config/tabs/', sheet_tabs),
    path('api/data/', include('googlesheet.data_urls')),  # liste et synchronisation des onglets
    path('api/data/', include('wealth.urls')),  # lignes d'un onglet, avec devises et mois prochain
    path('api/profile/', include('profiles.urls')),
    path('api/fx/', include('fx.urls')),
    path('api/auth/', include('accounts.urls')),
]
