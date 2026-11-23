"""
Recherche des taux en base (table fx_exchangerate) : le taux d'une devise à une date, en remontant au dernier jour
de cotation (week-ends et jours fériés de la BCE), au plus MAX_GAP_DAYS jours en arrière. Au-delà (devise suspendue,
date antérieure à la devise), pas de taux. Après le dernier jour publié (BCE injoignable), le dernier taux sert.
"""
import bisect
import datetime
from typing import Dict, List, Optional

from .models import ExchangeRate

MAX_GAP_DAYS = 7

# Devises publiées par la BCE (et l'euro) : sert à reconnaître une devise écrite dans la feuille (case M1 de portfolio)
ISO_CODES = {
    "EUR", "USD", "JPY", "CZK", "DKK", "GBP", "HUF", "PLN", "RON", "SEK", "CHF", "ISK", "NOK", "TRY", "AUD",
    "BRL", "CAD", "CNY", "HKD", "IDR", "ILS", "INR", "KRW", "MXN", "MYR", "NZD", "PHP", "SGD", "THB", "ZAR",
}

# Ordre d'affichage : d'abord les devises les plus courantes pour Overfolio, puis les autres par ordre alphabétique
PREFERRED = ["EUR", "USD", "CHF", "THB"]


def sort_codes(codes) -> List[str]:
    codes = set(codes)
    return [code for code in PREFERRED if code in codes] + sorted(codes - set(PREFERRED))


class RateBook:
    """Taux chargés une fois en mémoire : {devise: (dates triées, taux)}. EUR vaut toujours 1."""

    def __init__(self, since: Optional[datetime.date] = None):
        queryset = ExchangeRate.objects.order_by("currency", "date").values_list("currency", "date", "rate")
        if since is not None:
            queryset = queryset.filter(date__gte=since - datetime.timedelta(days=MAX_GAP_DAYS))
        self._dates: Dict[str, List[datetime.date]] = {}
        self._rates: Dict[str, List[float]] = {}
        for code, day, rate in queryset:
            self._dates.setdefault(code, []).append(day)
            self._rates.setdefault(code, []).append(float(rate))
        # Dernier jour publié : au-delà (taux du jour pas encore paru, BCE injoignable), le dernier taux sert
        self._latest = max((dates[-1] for dates in self._dates.values()), default=None)

    @property
    def codes(self) -> List[str]:
        """Devises connues (EUR compris). Les anciennes devises de l'historique (RUB, HRK, BGN…) sont écartées."""
        return sort_codes(["EUR", *(code for code in self._dates if code in ISO_CODES)])

    def rate(self, code: str, day: datetime.date) -> Optional[float]:
        """Unités de `code` pour 1 EUR le jour `day` (dernier taux connu jusqu'à 7 jours avant), sinon None."""
        if code == "EUR":
            return 1.0
        dates = self._dates.get(code)
        if not dates:
            return None
        index = bisect.bisect_right(dates, day) - 1
        if index < 0:
            return None
        still_quoted = dates[index] == self._latest  # devise encore cotée au dernier jour publié
        if (day - dates[index]).days > MAX_GAP_DAYS and not still_quoted:
            return None
        return self._rates[code][index]

    def known(self, code: str) -> bool:
        return code == "EUR" or code in self._dates
