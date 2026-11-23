"""
Devises calculées par le site, avec les taux de la BCE (app fx).

- Table `history` (montants toujours en euros) : pour chaque relevé, le montant en euros (actifs + dettes, signé)
  converti dans chaque devise connue -> SheetRow.computed["fx"] = {"EUR": …, "USD": …, "THB": …}.
- Table dont la devise n'est pas l'euro (portfolio, case M1) : Assets / Liabilities Master Currency convertis en
  euros au taux du jour du relevé -> SheetRow.computed["eur"]. L'API les montre à la place des valeurs de la feuille.
- Les valeurs de la feuille (SheetRow.data) ne sont jamais modifiées : l'API fusionne (data_views.table_detail).
"""
import datetime
import re
from typing import Dict, Iterable, List, Optional

from django.utils import timezone

from fx.rates import ISO_CODES, RateBook, sort_codes

from .models import SheetRow, SheetTable

HISTORY_TABLE = "history"
ASSETS = "Assets Master Currency"
LIABILITIES = "Liabilities Master Currency"
DEFAULT_CODES = ["EUR", "USD", "CHF", "THB"]  # devises montrées tant que le profil n'en a pas choisi

_SPACES = re.compile(r"[\s  €$£]")


def normalize(name) -> str:
    return re.sub(r"\s+", " ", str(name or "")).strip().lower()


def find_column(columns: Iterable[str], name: str) -> Optional[str]:
    wanted = normalize(name)
    return next((column for column in columns if normalize(column) == wanted), None)


def to_number(value) -> Optional[float]:
    """Comme toNumber du site (lib/aggregate.js), mais None pour une cellule vide ou non numérique."""
    if isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        return float(value)
    if not isinstance(value, str) or not value.strip():
        return None
    text = _SPACES.sub("", value)
    if "," in text and "." in text:
        text = text.replace(".", "")
    try:
        return float(text.replace(",", "."))
    except ValueError:
        return None


def to_date(value) -> Optional[datetime.date]:
    """Comme toIsoDate du site (lib/dates.js) : 2026-11-14, 14/11/2026, numéro de série Google Sheets."""
    if value is None or value == "" or isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        if 20_000 <= value <= 80_000:
            return datetime.date(1899, 12, 30) + datetime.timedelta(days=int(value))
        return None
    text = str(value).strip()
    match = re.match(r"^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?!\d)", text)
    if match:
        year, month, day = match.groups()
    else:
        match = re.match(r"^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})(?!\d)", text)
        if not match:
            return None
        day, month, year = match.groups()
    try:
        return datetime.date(int(year), int(month), int(day))
    except ValueError:
        return None


def currency_token(column: str, code: str) -> bool:
    """Colonne de montants de la feuille pour cette devise (comme findCurrencyColumn du site)."""
    name = str(column)
    if re.search(r"price|prix|quantit|unit|liabilit|dette|passif", name, re.I):
        return False
    return re.search(rf"(^|[^a-z]){code}([^a-z]|$)", name, re.I) is not None


def detect_currency(values: List[list], header_row: int, columns: List[str]) -> str:
    """
    Devise des montants, écrite au-dessus de la ligne d'en-tête (case M1 de portfolio) : code ISO connu le plus
    proche de la colonne « Assets Master Currency ». EUR si rien n'est trouvé.
    """
    above = values[: max(0, header_row - 1)]
    header = values[header_row - 1] if 0 < header_row <= len(values) else []
    target = next((i for i, cell in enumerate(header) if normalize(cell) == normalize(ASSETS)), None)
    found = []
    for row in above:
        for index, cell in enumerate(row):
            code = str(cell or "").strip().upper()
            if code in ISO_CODES:
                found.append((abs(index - target) if target is not None else index, code))
    return min(found)[1] if found else "EUR"


def _round(value: float) -> float:
    return round(value, 2)


def apply_currencies(table: SheetTable, book: RateBook, today: Optional[datetime.date] = None) -> Dict[str, int]:
    """Calcule et enregistre SheetRow.computed pour une table ; renvoie {rows, converted, missing_rate}."""
    today = today or timezone.localdate()
    columns = table.columns or []
    date_col = find_column(columns, "Date")
    assets_col = find_column(columns, ASSETS)
    liabilities_col = find_column(columns, LIABILITIES)
    legacy_eur = find_column(columns, "EUR")
    is_history = table.name == HISTORY_TABLE
    convert_from = (table.currency or "EUR").upper()
    stats = {"rows": 0, "converted": 0, "missing_rate": 0}

    rows = list(table.rows.all())
    for row in rows:
        data = row.data or {}
        day = to_date(data.get(date_col)) if date_col else None
        computed = {}

        assets = to_number(data.get(assets_col)) if assets_col else None
        debts = to_number(data.get(liabilities_col)) if liabilities_col else None

        # Montants dans une autre devise que l'euro : convertis en euros au taux du jour (sinon du jour de calcul)
        if convert_from != "EUR" and (assets is not None or debts is not None):
            rate = book.rate(convert_from, day or today)
            if rate:
                eur = {}
                if assets is not None:
                    assets = eur[assets_col] = _round(assets / rate)
                if debts is not None:
                    debts = eur[liabilities_col] = _round(debts / rate)
                computed["eur"] = eur
                stats["converted"] += 1
            else:
                stats["missing_rate"] += 1
                assets = debts = None  # pas de taux : pas de montant en euros fiable

        # history : le relevé dans chaque devise connue
        if is_history and day is not None:
            if assets is None and debts is None and legacy_eur:
                value = to_number(data.get(legacy_eur))  # anciens relevés : seule la colonne EUR, signée
            else:
                value = None if assets is None and debts is None else (assets or 0) + (debts or 0)
            if value is not None:
                fx = {}
                for code in book.codes:
                    rate = book.rate(code, day)
                    if rate:
                        fx[code] = _round(value * rate)
                    elif code in DEFAULT_CODES:
                        stats["missing_rate"] += 1
                computed["fx"] = fx

        if computed != (row.computed or {}):
            row.computed = computed
        stats["rows"] += 1

    SheetRow.objects.bulk_update(rows, ["computed"], batch_size=500)
    table.rates_applied_at = timezone.now()
    table.save(update_fields=["rates_applied_at"])
    return stats


def earliest_date(tables) -> Optional[datetime.date]:
    """Premier relevé des tables : les taux plus anciens ne sont pas chargés en mémoire (RateBook(since=…))."""
    days = []
    for table in tables:
        date_col = find_column(table.columns or [], "Date")
        if date_col:
            days.extend(filter(None, (to_date(data.get(date_col)) for data in table.rows.values_list("data", flat=True))))
    return min(days) if days else None


def tables_to_compute(owner=None, names: Optional[Iterable[str]] = None):
    """Tables à calculer : history et celles dont la devise n'est pas l'euro (d'un propriétaire, ou toutes)."""
    queryset = SheetTable.objects.all() if owner == "all" else SheetTable.objects.filter(user=owner)
    if names is not None:
        queryset = queryset.filter(name__in=list(names))
    return [table for table in queryset if table.name == HISTORY_TABLE or (table.currency or "EUR") != "EUR"]


def merged_rows(table: SheetTable, selected: List[str]):
    """
    Lignes et colonnes envoyées au site : valeurs de la feuille, montants convertis en euros à la place des
    montants d'origine, et pour history les devises choisies qui n'ont pas de colonne dans la feuille.
    Renvoie (colonnes, lignes, devises ajoutées, devises disponibles, lignes non converties faute de taux).
    """
    columns = list(table.columns or [])
    pairs = list(table.rows.order_by("position").values_list("data", "computed"))
    computed_codes = set()
    for _, computed in pairs:
        computed_codes.update((computed or {}).get("fx", {}).keys())
    in_sheet = {code for code in ISO_CODES if any(currency_token(column, code) for column in columns)}
    available = sort_codes(computed_codes | in_sheet)
    wanted = selected or DEFAULT_CODES
    added = [code for code in wanted if code in computed_codes and code not in in_sheet and code not in columns]
    foreign = (table.currency or "EUR").upper() != "EUR"
    amount_columns = [column for column in (find_column(columns, ASSETS), find_column(columns, LIABILITIES)) if column]
    unconverted = 0

    rows = []
    for data, computed in pairs:
        row = dict(data or {})
        computed = computed or {}
        if foreign and "eur" not in computed and any(to_number(row.get(column)) is not None for column in amount_columns):
            unconverted += 1  # montants restés dans la devise de la feuille : pas de taux BCE pour ce jour
        row.update(computed.get("eur", {}))
        fx = computed.get("fx", {})
        for code in added:
            if code in fx:
                row[code] = fx[code]
        rows.append(row)
    return columns + added, rows, added, available, unconverted
