from django.contrib import admin

from .models import GoogleAccount


@admin.register(GoogleAccount)
class GoogleAccountAdmin(admin.ModelAdmin):
    list_display = ("email", "name", "created_at", "updated_at")
    search_fields = ("email", "name")
    readonly_fields = ("sub", "drive_authorized_at", "created_at", "updated_at")
    exclude = ("drive_refresh_token",)  # jeton chiffré du mode 3 : ni affiché ni modifiable
