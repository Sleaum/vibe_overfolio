from django.contrib import admin
from django.urls import path, include

from googlesheet.data_views import sheet_config

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/sheet-config/', sheet_config),
    path('api/sheet', include('googlesheet.urls')),
    path('api/data/', include('googlesheet.data_urls')),
]
