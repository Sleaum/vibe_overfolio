from django.contrib import admin

from .models import PortfolioDay, SheetConfig, SheetRow, SheetTable


@admin.register(SheetTable)
class SheetTableAdmin(admin.ModelAdmin):
    list_display = ("name", "row_count", "header_row", "synced_at")
    readonly_fields = ("name", "columns", "header_row", "row_count", "synced_at")


@admin.register(SheetRow)
class SheetRowAdmin(admin.ModelAdmin):
    list_display = ("table", "position", "apercu")
    list_filter = ("table",)
    list_select_related = ("table",)

    @admin.display(description="Aperçu")
    def apercu(self, obj):
        return str(obj.data)[:120]


@admin.register(SheetConfig)
class SheetConfigAdmin(admin.ModelAdmin):
    list_display = ("__str__", "client_email", "sheet_id", "doc_name", "updated_at")
    exclude = ("private_key",)  # la clé privée ne s'affiche pas dans l'admin


@admin.register(PortfolioDay)
class PortfolioDayAdmin(admin.ModelAdmin):
    list_display = ("__str__", "assets", "liabilities", "currency", "recorded_at")
    list_filter = ("user",)
