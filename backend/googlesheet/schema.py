"""
Colonnes connues de chaque onglet de la feuille : nom canonique, autres noms acceptés, type. Seule source de vérité
pour lire la feuille, côté serveur (et bientôt côté site, qui lira les lignes déjà normalisées).

La base garde les cellules telles que la feuille les donne (SheetRow.data) : la normalisation se fait à la lecture
(normalize_rows), si bien qu'un nom accepté ajouté ici vaut tout de suite, sans resynchroniser.

Types :
- date : "AAAA-MM-JJ" ou None ;
- amount : nombre ou None, dans la devise de la feuille (converti dans la devise d'affichage par currencies.py) ;
- number : nombre ou None, jamais converti (quantité) ;
- text : texte sans espaces autour, "" si vide.
"""
import datetime
import math
import re
import unicodedata
from dataclasses import dataclass
from typing import Dict, Iterable, List, Optional, Tuple

from fx.rates import ISO_CODES

DATE, AMOUNT, NUMBER, TEXT = "date", "amount", "number", "text"


@dataclass(frozen=True)
class Column:
    name: str
    type: str
    aliases: Tuple[str, ...] = ()

    @property
    def names(self) -> Tuple[str, ...]:
        return (self.name, *self.aliases)


DATE_COLUMN = Column("Date", DATE, ("Mois", "Month"))
ASSETS = "Assets Master Currency"
LIABILITIES = "Liabilities Master Currency"

# portfolio, history et stock décrivent tous des positions.
POSITIONS = (
    DATE_COLUMN,
    Column("Asset", TEXT),
    Column("Sub Asset", TEXT, ("Sub-Asset", "SubAsset", "Sous-type", "Sous type")),
    Column("Instrument", TEXT, ("Instruments",)),
    Column("Ticker", TEXT, ("Symbol", "Symbole")),
    Column("Name", TEXT, ("Nom",)),
    Column("Envelope", TEXT, ("Enveloppe", "Account", "Compte", "Wrapper")),
    Column("Broker", TEXT, ("Courtier",)),
    Column("Area", TEXT, ("Zone", "Region", "Région", "Pays", "Country", "Localisation")),
    Column("Quantity", NUMBER, ("Quantité", "Quantite", "Qty")),
    Column(ASSETS, AMOUNT),
    Column(LIABILITIES, AMOUNT),
    # Devise de cotation : un code, jamais un montant.
    Column("Currency Price", TEXT),
    Column("Sector", TEXT, ("Secteur",)),
    Column("Moat", TEXT, ("Avantage concurrentiel",)),
    Column("Rating", TEXT, ("Note SP Trié", "Note SP Trie", "Note SP", "S&P Rating", "SP Rating", "Notation", "Note")),
    Column("Business", TEXT, ("Business Model", "Modèle", "Modele")),
    Column("Exchange", TEXT, ("New Field", "Place", "Bourse", "Place de cotation")),
)

SCHEMAS: Dict[str, Tuple[Column, ...]] = {
    "portfolio": POSITIONS,
    "history": POSITIONS,
    "stock": POSITIONS,
    "inout": (
        DATE_COLUMN,
        Column("In", AMOUNT, ("Entree", "Entrees")),
        Column("Out", AMOUNT, ("Sortie", "Sorties")),
        Column("Tax", AMOUNT, ("Taxe", "Taxes", "Impot", "Impots")),
    ),
    "budget": (
        Column("Source", TEXT),
        Column("Destination", TEXT),
        Column("Value", AMOUNT, ("Valeur", "Montant")),
    ),
}

# Onglet ajouté à la liste de synchronisation : seuls ses montants sont reconnus, pour rester convertis dans la
# devise d'affichage comme ceux des autres onglets.
OTHER_TABLE = (Column(ASSETS, AMOUNT), Column(LIABILITIES, AMOUNT))


def table_schema(table: str) -> Tuple[Column, ...]:
    return SCHEMAS.get(table, OTHER_TABLE)


# Onglet où les colonnes EUR, USD… sont des montants dans cette devise (relevés de « Patrimoine par devise »).
CURRENCY_COLUMNS_TABLE = "history"


# ---------- Noms de colonnes ----------

def normalize_name(name) -> str:
    """Sans casse, accents, espaces en trop, « _ » ni « - » : « Sous_type » et « sous-type » se valent."""
    text = unicodedata.normalize("NFD", str(name or ""))
    text = "".join(char for char in text if not unicodedata.combining(char))
    return re.sub(r"[\s_-]+", " ", text).strip().lower()


def find_column(columns: Iterable[str], names: Iterable[str]) -> Optional[str]:
    """Première colonne de la feuille (dans son ordre) qui porte l'un des noms."""
    wanted = {normalize_name(name) for name in names}
    return next((column for column in columns if normalize_name(column) in wanted), None)


def schema_column(table: str, name: str) -> Optional[Column]:
    return next((column for column in table_schema(table) if column.name == name), None)


def sheet_column(table: str, columns: Iterable[str], name: str) -> Optional[str]:
    """Colonne de la feuille pour le nom canonique `name` de l'onglet (ou ce nom seul s'il n'y est pas déclaré)."""
    known = schema_column(table, name)
    return find_column(columns, known.names if known else (name,))


def currency_token(column: str, code: str) -> bool:
    """Colonne de montants dans la devise `code` (« EUR », « Total USD »), pas un prix ni une dette."""
    name = str(column)
    if re.search(r"price|prix|quantit|unit|liabilit|dette|passif", name, re.I):
        return False
    return re.search(rf"(^|[^a-z]){code}([^a-z]|$)", name, re.I) is not None


def currency_columns(columns: Iterable[str]) -> Dict[str, str]:
    """{colonne de la feuille: code} des colonnes de montants par devise (EUR, USD…)."""
    return {column: code for column in columns for code in ISO_CODES if currency_token(column, code)}


@dataclass(frozen=True)
class Resolved:
    """Correspondance entre les colonnes de la feuille et les noms canoniques d'un onglet."""
    columns: Tuple[str, ...]        # noms envoyés, dans l'ordre de la feuille
    sheet_names: Dict[str, str]     # {nom envoyé: nom dans la feuille}
    types: Dict[str, str]           # {nom envoyé: type}, colonnes connues seulement


def resolve_columns(table: str, columns: Iterable[str]) -> Resolved:
    """
    Nom canonique de chaque colonne de la feuille. Si deux colonnes portent des noms du même canonique, la première
    l'emporte et l'autre garde son nom. Une colonne inconnue passe telle quelle, sans type.
    """
    columns = list(columns)
    sheet_names, types = {}, {}
    for known in table_schema(table):
        found = find_column(columns, known.names)
        if found is not None and found not in sheet_names.values():
            sheet_names[known.name] = found
            types[known.name] = known.type
    canonical = {sheet: name for name, sheet in sheet_names.items()}
    currencies = currency_columns(columns) if table == CURRENCY_COLUMNS_TABLE else {}

    names = []
    for column in columns:
        name = canonical.get(column)
        if name is None and column in currencies and currencies[column] not in sheet_names:
            name = currencies[column]
            types[name] = AMOUNT
        if name is None:
            name = column if column not in sheet_names else f"{column} ({len(names) + 1})"
        sheet_names[name] = column
        names.append(name)
    return Resolved(tuple(names), {name: sheet_names[name] for name in names}, {name: types[name] for name in names if name in types})


# ---------- Cellules ----------

# Comme toNumber du site : espaces (y compris insécables) et symboles monétaires retirés, virgule décimale acceptée.
_IGNORED = re.compile(r"[\s  €$£]")
_DECIMAL = re.compile(r"^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$", re.I)


def to_number(value) -> Optional[float]:
    """Nombre de la cellule, ou None si elle est vide ou ne contient pas un nombre."""
    if isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        return float(value) if math.isfinite(value) else None
    if not isinstance(value, str) or not value.strip():
        return None
    text = _IGNORED.sub("", value)
    if "," in text and "." in text:
        text = text.replace(".", "")  # 1.234,50 : le point sépare les milliers
    text = text.replace(",", ".", 1)
    return float(text) if _DECIMAL.match(text) else None


_SERIAL_ORIGIN = datetime.date(1899, 12, 30)
_ISO = re.compile(r"^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?!\d)")
_DAY_FIRST = re.compile(r"^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})(?!\d)")


def to_date(value) -> Optional[datetime.date]:
    """2026-11-14, 2026/11/14, 14/11/2026, 14.11.2026, ou numéro de série Google Sheets (heure ignorée)."""
    if value is None or value == "" or isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        if not math.isfinite(value) or not 20_000 <= value <= 80_000:
            return None
        return _SERIAL_ORIGIN + datetime.timedelta(days=int(value))
    text = str(value).strip()
    match = _ISO.match(text)
    if match:
        year, month, day = match.groups()
    else:
        match = _DAY_FIRST.match(text)
        if not match:
            return None
        day, month, year = match.groups()
    if not 1900 <= int(year) <= 2200:
        return None
    try:
        return datetime.date(int(year), int(month), int(day))
    except ValueError:
        return None


def to_text(value) -> str:
    if value is None:
        return ""
    if isinstance(value, float) and value.is_integer():
        return str(int(value))  # 3.0 s'affiche « 3 », comme dans la feuille
    return str(value).strip()


def _empty(value) -> bool:
    return value is None or (isinstance(value, str) and not value.strip())


def parse_cell(kind: str, value):
    """(valeur normalisée, illisible) : une cellule remplie qu'on ne sait pas lire est vidée et signalée."""
    if kind == TEXT:
        return to_text(value), False
    if kind == DATE:
        day = to_date(value)
        return (day.isoformat() if day else None), day is None and not _empty(value)
    if kind in (AMOUNT, NUMBER):
        number = to_number(value)
        return number, number is None and not _empty(value)
    return value, False


@dataclass(frozen=True)
class Normalized:
    columns: Tuple[str, ...]
    rows: List[dict]
    types: Dict[str, str]
    sheet_names: Dict[str, str]
    invalid_cells: int


def normalize_rows(table: str, columns: Iterable[str], rows: Iterable[dict]) -> Normalized:
    """Lignes de la feuille avec les noms canoniques et les valeurs lues selon leur type."""
    resolved = resolve_columns(table, columns)
    pairs = list(zip(resolved.columns, (resolved.sheet_names[name] for name in resolved.columns)))
    invalid = 0
    out = []
    for data in rows:
        data = data or {}
        row = {}
        for name, sheet in pairs:
            kind = resolved.types.get(name)
            value, bad = parse_cell(kind, data.get(sheet)) if kind else (data.get(sheet, ""), False)
            row[name] = value
            invalid += bad
        out.append(row)
    return Normalized(resolved.columns, out, resolved.types, resolved.sheet_names, invalid)
