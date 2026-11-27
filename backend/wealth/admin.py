from django.contrib import admin

from .models import PortfolioDay


@admin.register(PortfolioDay)
class PortfolioDayAdmin(admin.ModelAdmin):
    list_display = ("__str__", "assets", "liabilities", "currency", "recorded_at")
    list_filter = ("user",)
