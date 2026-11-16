from django.contrib import admin
from django.urls import path, include

from googlesheet.data_views import sheet_config
#from django.views.generic import RedirectView

urlpatterns = [
    path('admin/', admin.site.urls),
    #path('api/', include('api.urls')),
    path('api/stripe/', include('payments.urls')),
    path('api/sheet-config/', sheet_config),
    path('api/sheet', include('googlesheet.urls')),
    path('api/data/', include('googlesheet.data_urls')),
    #path('', RedirectView.as_view(url='/api/googlesheet', permanent=False)),
]
