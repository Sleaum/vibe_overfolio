"""
Mois prochain dans history, pour les graphiques de la page Flow (GET /api/data/history/?projection=1).

Les positions actuelles (table portfolio) deviennent le relevé du mois suivant : chaque ligne de portfolio est
recopiée dans les colonnes de history, datée du 1er du mois qui suit la date des positions. Rien n'est écrit en base :
les lignes sont ajoutées à la volée, après celles de history. Elles remplacent les lignes que la feuille recopiait
de portfolio avec une date écrite à la main.

- Montants : dans la devise de history (l'euro) ; un portfolio dans une autre devise (case M1) est converti au taux
  du jour des positions. Les devises de « Patrimoine par devise » sont calculées comme pour les autres relevés.
- Pas de doublon : si history a déjà un relevé ce mois-là (lignes pas encore effacées de la feuille, ou vrai relevé),
  rien n'est ajouté.
- Une ligne de portfolio sans Asset ni Instrument n'est pas recopiée (dans history, ce serait un objectif).
"""
import datetime
from typing import List, Optional, Tuple

from django.utils import timezone

from fx.rates import ISO_CODES, RateBook

from .currencies import (
    amount_columns,
    currency_token,
    find_column,
    history_columns,
    normalize,
    row_fx,
    to_date,
    to_number,
    _round,
)
from .models import SheetTable

PORTFOLIO_TABLE = "portfolio"
LABELS = ["Asset", "Instrument"]


def next_month(day: datetime.date) -> datetime.date:
    """1er du mois suivant : 23 novembre 2026 -> 1er décembre 2026."""
    return (day.replace(day=1) + datetime.timedelta(days=32)).replace(day=1)


def _labelled(data: dict, label_columns: List[str]) -> bool:
    return any(str(data.get(column) or "").strip() for column in label_columns)


def projected_rows(history: SheetTable, today: Optional[datetime.date] = None) -> Tuple[List[tuple], Optional[dict]]:
    """
    Lignes du mois prochain pour `history` (même propriétaire) : ([(data, computed)], infos), ou ([], None) s'il n'y a
    rien à ajouter. infos = {date, rows, unconverted, source_date}.
    """
    columns = list(history.columns or [])
    date_col = find_column(columns, "Date")
    if not date_col:
        return [], None
    portfolio = SheetTable.objects.filter(user_id=history.user_id, name=PORTFOLIO_TABLE).first()
    if portfolio is None:
        return [], None

    p_columns = list(portfolio.columns or [])
    p_rows = list(portfolio.rows.order_by("position").values_list("data", flat=True))
    p_labels = [column for column in (find_column(p_columns, name) for name in LABELS) if column]
    p_rows = [data or {} for data in p_rows if _labelled(data or {}, p_labels)]
    if not p_rows:
        return [], None

    # Date des positions : la plus récente de portfolio (selon la place de cotation, une photo porte plusieurs dates)
    p_date = find_column(p_columns, "Date")
    days = [day for day in (to_date(data.get(p_date)) for data in p_rows) if day] if p_date else []
    positions = max(days) if days else (today or timezone.localdate())
    target = next_month(positions)

    # Mois déjà relevé dans history : la feuille fait foi
    h_labels = [column for column in (find_column(columns, name) for name in LABELS) if column]
    for data in history.rows.values_list("data", flat=True):
        day = to_date((data or {}).get(date_col))
        if day and (day.year, day.month) == (target.year, target.month) and _labelled(data or {}, h_labels):
            return [], None

    # Colonnes de history remplies depuis portfolio (même nom, sans tenir compte de la casse ni des accents)
    by_name = {normalize(column): column for column in p_columns}
    mapping = {column: by_name.get(normalize(column)) for column in columns}
    amounts = amount_columns(history.name, columns)
    sheet_currencies = {
        column: code for column in columns for code in ISO_CODES if currency_token(column, code)
    }  # colonnes EUR, USD… encore présentes dans la feuille : remplies avec les montants calculés

    source = (portfolio.currency or "EUR").upper()
    target_currency = (history.currency or "EUR").upper()
    book = RateBook(since=min([*days, positions]))
    cols = history_columns(columns)

    extra, unconverted = [], 0
    for p_data in p_rows:
        data = {column: (p_data.get(mapping[column], "") if mapping[column] else "") for column in columns}
        data[date_col] = target.isoformat()
        if source != target_currency:
            day = (to_date(p_data.get(p_date)) if p_date else None) or positions
            source_rate, target_rate = book.rate(source, day), book.rate(target_currency, day)
            missing = False
            for column in amounts:
                value = to_number(data.get(column))
                if value is None:
                    continue
                if source_rate and target_rate:
                    data[column] = _round(value / source_rate * target_rate)
                else:
                    data[column] = ""  # pas de taux : montant écarté plutôt que faux
                    missing = True
            unconverted += missing
        fx, _ = row_fx(data, cols, book, target_currency)
        computed = {"fx": fx} if fx is not None else {}
        for column, code in sheet_currencies.items():
            if mapping[column] is None:  # portfolio n'a pas cette colonne : valeur calculée
                data[column] = (fx or {}).get(code, "")
        extra.append((data, computed))

    return extra, {
        "date": target.isoformat(),
        "rows": len(extra),
        "unconverted": unconverted,
        "source_date": positions.isoformat(),
    }
