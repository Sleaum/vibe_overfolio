"""
PortfolioDay passe de googlesheet à wealth sans toucher à la base : la table googlesheet_portfolioday et ses lignes
restent telles quelles (Meta.db_table). Seul l'état des modèles de Django change ; googlesheet 0009 retire le modèle
de son côté.
"""
import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ("googlesheet", "0008_compte_de_service_chiffre"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            state_operations=[
                migrations.CreateModel(
                    name="PortfolioDay",
                    fields=[
                        ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                        ("day", models.DateField()),
                        ("assets", models.FloatField(default=0)),
                        ("liabilities", models.FloatField(default=0)),
                        ("currency", models.CharField(default="EUR", max_length=3)),
                        ("source", models.CharField(blank=True, default="", max_length=200)),
                        ("recorded_at", models.DateTimeField(auto_now=True)),
                        (
                            "user",
                            models.ForeignKey(
                                blank=True,
                                null=True,
                                on_delete=django.db.models.deletion.CASCADE,
                                related_name="portfolio_days",
                                to=settings.AUTH_USER_MODEL,
                            ),
                        ),
                    ],
                    options={
                        "db_table": "googlesheet_portfolioday",
                        "ordering": ["day"],
                        "constraints": [
                            models.UniqueConstraint(fields=("user", "day"), name="uniq_portfolioday_user_day"),
                            models.UniqueConstraint(
                                condition=models.Q(("user__isnull", True)),
                                fields=("day",),
                                name="uniq_portfolioday_site_day",
                            ),
                        ],
                    },
                ),
            ],
            database_operations=[],
        ),
    ]
