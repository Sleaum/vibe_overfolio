"""
Devises calculées par le site, avec les taux de la BCE (app fx).

- Table `history` (montants toujours en euros) : pour chaque relevé, le montant en euros (actifs + dettes, signé)
  converti dans chaque devise connue -> SheetRow.computed["fx"] = {"EUR": …, "USD": …, "THB": …}, calculé à la
  synchronisation (graphique « Patrimoine par devise »).
- Devise d'affichage (menu de l'en-tête, GET /api/data/<onglet>/?currency=THB) : les colonnes de montants
  (AMOUNT_COLUMNS) sont converties à la demande, de la devise de la feuille (SheetTable.currency, case M1 de
  portfolio, EUR par défaut) vers la devise demandée, au taux du jour de chaque ligne (merged_rows).
- Les valeurs de la feuille (SheetRow.data) ne sont jamais modifiées : l'API fusionne (data_views.table_detail).
"""
import datetime
import re
import unicodedata
from typing import Dict, Iterable, List, Optional

from django.utils import timezone

from fx.rates import ISO_CODES, RateBook, sort_codes

from .models import SheetRow, SheetTable

HISTORY_TABLE = "history"
ASSETS = "Assets Master Currency"
LIABILITIES = "Liabilities Master Currency"
DEFAULT_CODES = ["EUR", "USD", "CHF", "THB"]  # devises montrées tant que le profil n'en a pas choisi

# Colonnes de montants converties dans la devise d'affichage (mêmes noms que ceux que lisent les graphiques du site).
# « Currency Price » (devise de cotation) et « Equity » (plusieurs devises) ne sont pas des montants à convertir.
AMOUNT_COLUMNS = [ASSETS, LIABILITIES]
TABLE_AMOUNT_COLUMNS = {
    "inout": ["in", "entree", "entrees", "out", "sortie", "sorties", "tax", "taxe", "taxes", "impot", "impots"],
    "budget": ["Valeur", "Value", "Montant"],
}
DATE_COLUMNS = ["Date", "mois", "month"]

_SPACES = re.compile(r"[\s  €$£]")


def normalize(name) -> str:
    """Comme le site (findColumn de lib/aggregate.js) : sans casse, accents, espaces, « _ » ni « - » en trop."""
    text = unicodedata.normalize("NFD", str(name or ""))
    text = "".join(char for char in text if not unicodedata.combining(char))
    return re.sub(r"[\s_-]+", " ", text).strip().lower()


def find_column(columns: Iterable[str], name: str) -> Optional[str]:
    wanted = normalize(name)
    return next((column for column in columns if normalize(column) == wanted), None)


def find_any(columns: Iterable[str], names: Iterable[str]) -> Optional[str]:
    """Première colonne qui porte l'un des noms (dans l'ordre des colonnes, comme findColumn du site)."""
    wanted = {normalize(name) for name in names}
    return next((column for column in columns if normalize(column) in wanted), None)


def amount_columns(table_name: str, columns: List[str]) -> List[str]:
    """Colonnes de montants de la table, à convertir dans la devise d'affichage."""
    names = AMOUNT_COLUMNS + TABLE_AMOUNT_COLUMNS.get(table_name, [])
    wanted = {normalize(name) for name in names}
    return [column for column in columns if normalize(column) in wanted]


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


def history_columns(columns: List[str]) -> Dict[str, Optional[str]]:
    """Colonnes de history utiles au calcul des devises : date, actifs, dettes, ancienne colonne EUR."""
    return {
        "date": find_column(columns, "Date"),
        "assets": find_column(columns, ASSETS),
        "liabilities": find_column(columns, LIABILITIES),
        "legacy_eur": find_column(columns, "EUR"),
    }


def row_fx(data: dict, cols: Dict[str, Optional[str]], book: RateBook, source: str = "EUR"):
    """
    Relevé d'une ligne de history dans chaque devise connue : ({devise: montant}, devises par défaut sans taux),
    ou (None, 0) si la ligne n'a ni date ni montant, (None, 1) s'il manque le taux de sa devise.
    """
    day = to_date(data.get(cols["date"])) if cols["date"] else None
    if day is None:
        return None, 0
    assets = to_number(data.get(cols["assets"])) if cols["assets"] else None
    debts = to_number(data.get(cols["liabilities"])) if cols["liabilities"] else None
    if assets is None and debts is None and cols["legacy_eur"]:
        value = to_number(data.get(cols["legacy_eur"]))  # anciens relevés : seule la colonne EUR, signée
        rate = 1.0
    else:
        value = None if assets is None and debts is None else (assets or 0) + (debts or 0)
        rate = book.rate(source, day)  # history est en euros ; une autre devise passe par l'euro
    if value is None:
        return None, 0
    if not rate:
        return None, 1
    fx, missing = {}, 0
    for code in book.codes:
        code_rate = book.rate(code, day)
        if code_rate:
            fx[code] = _round(value / rate * code_rate)
        elif code in DEFAULT_CODES:
            missing += 1
    return fx, missing


def apply_currencies(table: SheetTable, book: RateBook) -> Dict[str, int]:
    """
    history : calcule et enregistre SheetRow.computed["fx"] (le relevé dans chaque devise connue). Les autres tables
    n'ont rien à garder (conversion à la demande, merged_rows). Renvoie {rows, converted, missing_rate}.
    """
    cols = history_columns(table.columns or [])
    is_history = table.name == HISTORY_TABLE
    source = (table.currency or "EUR").upper()
    stats = {"rows": 0, "converted": 0, "missing_rate": 0}

    rows = list(table.rows.all())
    for row in rows:
        computed = {}
        if is_history:
            fx, missing = row_fx(row.data or {}, cols, book, source)
            stats["missing_rate"] += missing
            if fx is not None:
                computed["fx"] = fx
                stats["converted"] += 1
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


def merged_rows(
    table: SheetTable,
    selected: List[str],
    display: str = "EUR",
    today: Optional[datetime.date] = None,
    extra: Optional[List[tuple]] = None,
):
    """
    Lignes et colonnes envoyées au site :
    - valeurs de la feuille, colonnes de montants converties dans la devise `display` (de la devise de la feuille,
      au taux du jour de chaque ligne ; sans date, au dernier taux). Sans taux, le montant est vidé (jamais un
      montant faux) et la ligne est comptée dans `unconverted` ;
    - pour history, les devises choisies (et `display`) qui n'ont pas de colonne dans la feuille ;
    - `extra` : lignes ajoutées après celles de la base, [(data, computed)] (mois prochain, projection.py).
    Renvoie (colonnes, lignes, devises ajoutées, devises disponibles, lignes non converties).
    """
    today = today or timezone.localdate()
    display = (display or "EUR").upper()
    source = (table.currency or "EUR").upper()
    columns = list(table.columns or [])
    pairs = list(table.rows.order_by("position").values_list("data", "computed")) + list(extra or [])

    computed_codes = set()
    for _, computed in pairs:
        computed_codes.update((computed or {}).get("fx", {}).keys())
    in_sheet = {code for code in ISO_CODES if any(currency_token(column, code) for column in columns)}
    available = sort_codes(computed_codes | in_sheet)
    wanted = list(selected or DEFAULT_CODES)
    if display not in wanted:
        wanted.append(display)  # colonne de la devise d'affichage : sert aux anciens relevés et à la tendance
    added = [code for code in wanted if code in computed_codes and code not in in_sheet and code not in columns]

    amounts = amount_columns(table.name, columns) if display != source else []
    date_col = find_any(columns, DATE_COLUMNS)
    book = None
    if amounts:
        days = [to_date((data or {}).get(date_col)) for data, _ in pairs] if date_col else []
        known = [day for day in days if day]
        book = RateBook(since=min(known) if known else None, codes={source, display})

    unconverted = 0
    rows = []
    for data, computed in pairs:
        row = dict(data or {})
        if amounts:
            day = (to_date(row.get(date_col)) if date_col else None) or today
            source_rate, display_rate = book.rate(source, day), book.rate(display, day)
            missing = False
            for column in amounts:
                value = to_number(row.get(column))
                if value is None:
                    continue
                if source_rate and display_rate:
                    row[column] = _round(value / source_rate * display_rate)
                else:
                    row[column] = ""  # pas de taux pour ce jour : montant écarté plutôt que faux
                    missing = True
            unconverted += missing
        fx = (computed or {}).get("fx", {})
        for code in added:
            if code in fx:
                row[code] = fx[code]
        rows.append(row)
    return columns + added, rows, added, available, unconverted
