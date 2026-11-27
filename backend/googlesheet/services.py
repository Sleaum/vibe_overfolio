import datetime
import hashlib
import io
import logging
import re
from typing import Any, List, Optional, Tuple

import gspread
import requests
from requests.exceptions import RequestException

logger = logging.getLogger(__name__)

# Client gspread créé à la première requête (et non au démarrage de Django), puis réutilisé
# tant que les identifiants ne changent pas. Si l'initialisation échoue, elle est retentée ensuite.
_client: Optional[gspread.client.Client] = None
_client_fingerprint: str = ""

_REQUIRED_FIELDS = ("type", "project_id", "private_key", "client_email")
_NUMBER_RE = re.compile(r"^-?(0|[1-9]\d*)(\.\d+)?$")


class SheetError(Exception):
    """
    Erreur lisible par l'utilisateur, avec le code HTTP à renvoyer.
    `code` et `params` permettent au site de l'afficher dans la langue choisie (voir errors.py).
    """
    status = 500

    def __init__(self, message, code="sheet_error", **params):
        super().__init__(message)
        self.code = code
        self.params = params


class SheetConfigError(SheetError):
    status = 500


class SheetNotFound(SheetError):
    status = 404


class SheetAPIError(SheetError):
    status = 502


def get_credentials(owner=None) -> dict:
    """Identifiants du compte de service : ceux saisis sur la page GoogleSheet, sinon ceux du .env (site seulement)."""
    from . import config  # import différé : config dépend des modèles

    return config.credentials(owner)


def _fingerprint(credentials: dict) -> str:
    raw = "\x00".join(f"{key}={credentials.get(key) or ''}" for key in sorted(credentials))
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def get_client(owner=None) -> gspread.client.Client:
    """Client gspread réutilisé tant que les identifiants ne changent pas."""
    global _client, _client_fingerprint

    credentials = get_credentials(owner)
    fingerprint = _fingerprint(credentials)
    if _client is not None and fingerprint == _client_fingerprint:
        return _client

    missing = [f for f in _REQUIRED_FIELDS if not credentials.get(f)]
    if missing:
        raise SheetConfigError(
            "Identifiants Google incomplets, champs manquants : "
            + ", ".join(missing)
            + ". Complète-les sur la page GoogleSheet.",
            "credentials_incomplete",
            fields=", ".join(missing),
        )
    try:
        _client = gspread.service_account_from_dict(credentials)
    except Exception as exc:  # clé PEM illisible, etc.
        _client = None
        logger.exception("Initialisation du client Google Sheets impossible")
        raise SheetConfigError(f"Identifiants Google invalides : {exc}", "credentials_invalid", detail=str(exc)) from exc
    _client_fingerprint = fingerprint
    return _client


def initialize_gspread() -> gspread.client.Client:
    """Conservé pour compatibilité avec l'ancien settings.py."""
    return get_client()


def _convert(value: Any) -> Any:
    """'12' -> 12, '12.5' -> 12.5. Le reste reste du texte (dates, '007', '1,5 €')."""
    if isinstance(value, str):
        value = value.strip()
        if _NUMBER_RE.match(value):
            return float(value) if "." in value else int(value)
    return value


def _is_number(value: Any) -> bool:
    if isinstance(value, bool):
        return False
    if isinstance(value, (int, float)):
        return True
    return bool(_NUMBER_RE.match(str(value).strip()))


def detect_header_index(values: List[List[Any]], max_scan: int = 10) -> int:
    """
    Repère la ligne d'en-tête : la première des 10 premières lignes qui contient au moins
    3 cellules remplies, toutes textuelles. Une ligne de synthèse placée au-dessus de
    l'en-tête (avec des totaux ou des dates) est ainsi ignorée. Repli : première ligne.
    """
    for index, row in enumerate(values[:max_scan]):
        cells = [cell for cell in row if str(cell).strip()]
        if len(cells) >= 3 and not any(_is_number(cell) for cell in cells):
            return index
    return 0


def parse_values(
    values: List[List[Any]], header_row: Optional[int] = None
) -> Tuple[int, List[str], List[dict]]:
    """
    Transforme la grille brute d'une feuille (liste de listes) en lignes (dictionnaires).

    header_row : numéro (à partir de 1) de la ligne d'en-tête ; détecté automatiquement si absent.

    Renvoie (numéro de la ligne d'en-tête, noms des colonnes dans l'ordre, lignes).

    Contrairement à worksheet.get_all_records(), cette version ne plante pas quand
    l'en-tête contient des colonnes vides ou des doublons, ignore les lignes vides
    et tolère les lignes plus courtes que l'en-tête.
    """
    if not values:
        return (header_row or 1), [], []

    header_index = (header_row - 1) if header_row else detect_header_index(values)
    if header_index >= len(values):
        return header_index + 1, [], []

    columns = []  # (index dans la ligne, nom de colonne)
    seen: dict = {}
    for index, header in enumerate(values[header_index]):
        name = str(header).strip()
        if not name:
            continue
        seen[name] = seen.get(name, 0) + 1
        if seen[name] > 1:
            name = f"{name} ({seen[name]})"
        columns.append((index, name))

    rows = []
    for raw in values[header_index + 1:]:
        if not any(str(cell).strip() for cell in raw):
            continue
        rows.append(
            {
                name: _convert(raw[index]) if index < len(raw) else ""
                for index, name in columns
            }
        )
    return header_index + 1, [name for _, name in columns], rows


def _read_values(worksheet) -> List[List[Any]]:
    """
    Valeurs brutes (nombres réels, indépendants de la langue de la feuille : pas de
    "1 234,50" ni de symbole monétaire), avec les dates en texte comme affichées.
    """
    try:
        return worksheet.get_all_values(
            value_render_option="UNFORMATTED_VALUE",
            date_time_render_option="FORMATTED_STRING",
        )
    except TypeError:  # très ancienne version de gspread
        return worksheet.get_all_values()


# ---------- Lecture par lien public (solution 1 : feuille partagée « Tous les utilisateurs disposant du lien ») ----------

PUBLIC_EXPORT_URL = "https://docs.google.com/spreadsheets/d/{sheet_id}/export?format=xlsx"
PUBLIC_EXPORT_TIMEOUT = 30  # secondes
PUBLIC_EXPORT_MAX_BYTES = 30 * 1024 * 1024


def _public_cell(value: Any) -> Any:
    """
    Cellule du fichier Excel -> même forme que l'API (lecture par compte de service) :
    nombres en nombres (entiers sans « .0 »), dates en texte « AAAA-MM-JJ », cellule vide -> "".
    """
    if value is None:
        return ""
    if isinstance(value, datetime.datetime):
        if value.time() == datetime.time(0, 0):
            return value.date().isoformat()
        return value.strftime("%Y-%m-%d %H:%M")
    if isinstance(value, (datetime.date, datetime.time)):
        return value.isoformat()
    if isinstance(value, float) and value.is_integer():
        return int(value)
    return value


class PublicSpreadsheet:
    """
    Document lu sans identifiants : Google exporte toute la feuille partagée par lien en un fichier Excel
    (tous les onglets, valeurs calculées). Mêmes méthodes utiles que le document gspread : title, worksheet_titles().
    """

    def __init__(self, sheet_id: str, content: bytes):
        import openpyxl  # import différé : seulement pour ce mode

        self.sheet_id = sheet_id
        self._book = openpyxl.load_workbook(io.BytesIO(content), read_only=True, data_only=True)
        self.title = ""

    def worksheet_titles(self) -> List[str]:
        return list(self._book.sheetnames)

    def values(self, sheet_name: Optional[str] = None) -> List[List[Any]]:
        names = self._book.sheetnames
        if not names:
            raise SheetNotFound("Le document ne contient aucun onglet.", "no_tabs")
        if sheet_name and sheet_name not in names:
            raise SheetNotFound(f"Onglet '{sheet_name}' introuvable.", "tab_not_found", tab=sheet_name)
        sheet = self._book[sheet_name or names[0]]
        return [[_public_cell(cell) for cell in row] for row in sheet.iter_rows(values_only=True)]


def open_public_spreadsheet(sheet_id: str) -> PublicSpreadsheet:
    """Télécharge la feuille partagée par lien. Erreur claire si elle n'est pas publique."""
    url = PUBLIC_EXPORT_URL.format(sheet_id=sheet_id)
    try:
        response = requests.get(url, timeout=PUBLIC_EXPORT_TIMEOUT, stream=True)
        content = response.raw.read(PUBLIC_EXPORT_MAX_BYTES + 1, decode_content=True)
    except RequestException as exc:
        logger.warning("Google Sheets injoignable : %s", exc)
        raise SheetAPIError(f"Google Sheets est injoignable : {exc}", "google_unreachable", detail=str(exc))
    if len(content) > PUBLIC_EXPORT_MAX_BYTES:
        raise SheetAPIError("Feuille trop volumineuse pour être téléchargée.", "public_export_too_big")
    # Un fichier Excel est une archive zip (« PK ») ; sinon Google a renvoyé une page de connexion ou d'erreur
    if response.status_code == 404:
        raise SheetNotFound("Feuille introuvable : vérifie le lien du document.", "public_sheet_not_found")
    if response.status_code != 200 or not content.startswith(b"PK"):
        raise SheetNotFound(
            "La feuille n'est pas partagée par lien : dans Google Sheets, choisis « Tous les utilisateurs "
            "disposant du lien », ou renseigne un compte de service.",
            "sheet_not_public",
        )
    try:
        return PublicSpreadsheet(sheet_id, content)
    except Exception as exc:  # fichier illisible
        logger.exception("Export Excel illisible")
        raise SheetAPIError(f"Fichier exporté illisible : {exc}", "public_export_unreadable", detail=str(exc))


def worksheet_titles(spreadsheet) -> List[str]:
    """Noms des onglets du document, dans l'ordre (les deux modes)."""
    if isinstance(spreadsheet, PublicSpreadsheet):
        return spreadsheet.worksheet_titles()
    try:
        return [worksheet.title for worksheet in spreadsheet.worksheets()]
    except gspread.exceptions.APIError as exc:
        raise SheetAPIError(f"Erreur de l'API Google Sheets : {exc}", "google_api_error", detail=str(exc))
    except RequestException as exc:
        raise SheetAPIError(f"Google Sheets est injoignable : {exc}", "google_unreachable", detail=str(exc))


def open_google_account_spreadsheet(owner, sheet_id: str):
    """Mode 3 : feuille choisie dans le sélecteur de Google, lue avec le compte Google de la personne (drive.file)."""
    from accounts import drive  # import différé

    try:
        client = gspread.authorize(drive.fresh_credentials(owner))
    except drive.DriveError as exc:
        error = SheetConfigError(str(exc), exc.code)
        error.status = exc.status
        raise error
    try:
        return client.open_by_key(sheet_id)
    except gspread.exceptions.SpreadsheetNotFound:
        raise SheetNotFound(
            "Feuille introuvable ou plus autorisée : choisis-la de nouveau dans le sélecteur de Google.",
            "google_sheet_not_found",
        )
    except gspread.exceptions.APIError as exc:
        logger.warning("Erreur API Google Sheets (compte Google) : %s", exc.__class__.__name__)
        raise SheetAPIError(f"Erreur de l'API Google Sheets : {exc}", "google_api_error", detail=str(exc))
    except RequestException as exc:
        raise SheetAPIError(f"Google Sheets est injoignable : {exc}", "google_unreachable", detail=str(exc))


def open_spreadsheet(doc_name: str, owner=None):
    """
    Ouvre le document, selon le mode choisi par config.access_mode() :

    - « service_account » (solution 2) : API Google Sheets avec le compte de service. Le document est ouvert
      par son identifiant (partie de l'URL entre /d/ et /edit) s'il est connu, sinon cherché par son nom
      (doc_name, ce qui demande l'API Drive).
    - « public_link » (solution 1) : pas de compte de service, seulement le lien d'une feuille partagée
      « Tous les utilisateurs disposant du lien » : export Excel de toute la feuille.
    - « google » (solution 3, compte connecté) : feuille choisie dans le sélecteur de Google, lue avec son compte.

    owner : None = configuration du site, sinon celle du compte connecté.
    """
    from . import config

    mode = config.access_mode(owner=owner)
    if mode == "google":
        return open_google_account_spreadsheet(owner, config.sheet_id(owner))
    if mode == "public_link":
        return open_public_spreadsheet(config.sheet_id(owner))
    if mode == "none":
        raise SheetConfigError(
            "Aucun accès configuré : colle le lien d'une feuille partagée par lien, ou renseigne un compte de service.",
            "no_access_configured",
        )

    client = get_client(owner)
    sheet_id = config.sheet_id(owner)
    try:
        return client.open_by_key(sheet_id) if sheet_id else client.open(doc_name)
    except gspread.exceptions.SpreadsheetNotFound:
        email = get_credentials(owner).get("client_email") or "le compte de service"
        what = "l'identifiant du document" if sheet_id else f"le nom '{doc_name}'"
        raise SheetNotFound(
            f"Feuille introuvable (vérifie {what}) ou non partagée avec {email}.",
            "sheet_not_found_by_id" if sheet_id else "sheet_not_found_by_name",
            name=doc_name or "",
            email=email,
        )
    except gspread.exceptions.APIError as exc:
        logger.warning("Erreur API Google Sheets : %s", exc)
        raise SheetAPIError(f"Erreur de l'API Google Sheets : {exc}", "google_api_error", detail=str(exc))
    except RequestException as exc:
        logger.warning("Google Sheets injoignable : %s", exc)
        raise SheetAPIError(f"Google Sheets est injoignable : {exc}", "google_unreachable", detail=str(exc))


def read_worksheet_values(spreadsheet, sheet_name: Optional[str] = None) -> List[List[Any]]:
    """Grille brute d'un onglet (le premier si sheet_name est vide)."""
    if isinstance(spreadsheet, PublicSpreadsheet):
        return spreadsheet.values(sheet_name)
    try:
        worksheet = (
            spreadsheet.worksheet(sheet_name) if sheet_name else spreadsheet.get_worksheet(0)
        )
        if worksheet is None:
            raise SheetNotFound("Le document ne contient aucun onglet.", "no_tabs")
        return _read_values(worksheet)
    except gspread.exceptions.WorksheetNotFound:
        raise SheetNotFound(f"Onglet '{sheet_name}' introuvable.", "tab_not_found", tab=sheet_name)
    except gspread.exceptions.APIError as exc:
        logger.warning("Erreur API Google Sheets : %s", exc)
        raise SheetAPIError(f"Erreur de l'API Google Sheets : {exc}", "google_api_error", detail=str(exc))
    except RequestException as exc:
        logger.warning("Google Sheets injoignable : %s", exc)
        raise SheetAPIError(f"Google Sheets est injoignable : {exc}", "google_unreachable", detail=str(exc))
