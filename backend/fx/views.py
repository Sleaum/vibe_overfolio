from django.http import JsonResponse
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny

from .ecb import latest_date
from .models import ExchangeRate
from .rates import ISO_CODES, sort_codes


@api_view(["GET"])
@permission_classes([AllowAny])
def currencies(request):
    """
    GET /api/fx/currencies/ : devises proposées pour l'affichage (menu de l'en-tête) : l'euro, puis celles cotées par
    la BCE le dernier jour publié, avec ce taux (unités pour 1 EUR). Taux communs à tous : rien de propre au compte.
    """
    latest = latest_date()
    rates = {"EUR": 1.0}
    if latest is not None:
        for code, rate in ExchangeRate.objects.filter(date=latest).values_list("currency", "rate"):
            if code in ISO_CODES:
                rates[code] = float(rate)
    return JsonResponse(
        {
            "date": latest.isoformat() if latest else None,
            "currencies": [{"code": code, "rate": rates[code]} for code in sort_codes(rates)],
        }
    )
