"""
Taux de référence de l'euro, publiés par la Banque centrale européenne (BCE) chaque jour ouvré vers 16 h (heure
de Francfort) : https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/

- Base vide, ou dernier taux vieux de plus de 80 jours : tout l'historique depuis 1999 (fichier zip, environ 600 Ko).
- Sinon : les 90 derniers jours (petit fichier XML), seuls les jours manquants sont ajoutés.
Une vérification au plus par heure (cache), sauf force=True. Une erreur (réseau, fichier illisible) ne lève jamais :
elle est renvoyée dans le résultat, et les taux déjà en base restent utilisables.
"""
import csv
import datetime
import io
import logging
import xml.etree.ElementTree as ElementTree
import zipfile
from dataclasses import dataclass
from decimal import Decimal, InvalidOperation

import requests
from django.core.cache import cache
from django.db.models import Max

from .models import ExchangeRate

logger = logging.getLogger(__name__)

HISTORY_ZIP = "https://www.ecb.europa.eu/stats/eurofxref/eurofxref-hist.zip"
LAST_90_DAYS = "https://www.ecb.europa.eu/stats/eurofxref/eurofxref-hist-90d.xml"
TIMEOUT = 30
MAX_BYTES = 20 * 1024 * 1024
RECENT_DAYS = 80  # au-delà, le fichier des 90 jours ne suffit plus : historique complet
CHECK_KEY = "fx-ecb-checked"
CHECK_EVERY = 3600  # secondes


@dataclass
class Update:
    added: int = 0
    latest: datetime.date | None = None
    source: str = ""  # "history" (historique complet), "recent" (90 jours), "" (rien à faire)
    error: str = ""  # code d'erreur pour le site : fx_unreachable, fx_invalid


def _rate(text):
    try:
        value = Decimal(str(text).strip())
    except (InvalidOperation, ValueError):
        return None
    return value if value > 0 else None


def parse_history_zip(content: bytes):
    """Historique complet (CSV dans un zip) : Date,USD,JPY,…  ->  [(date, devise, taux)]. « N/A » est ignoré."""
    with zipfile.ZipFile(io.BytesIO(content)) as archive:
        name = next(name for name in archive.namelist() if name.lower().endswith(".csv"))
        text = archive.read(name).decode("utf-8-sig")
    rows = []
    reader = csv.reader(io.StringIO(text))
    header = [cell.strip() for cell in next(reader)]
    for record in reader:
        if not record or not record[0].strip():
            continue
        day = datetime.date.fromisoformat(record[0].strip())
        for code, cell in zip(header[1:], record[1:]):
            rate = _rate(cell)
            if len(code) == 3 and rate is not None:
                rows.append((day, code.upper(), rate))
    return rows


def parse_xml(content: bytes):
    """Fichier XML de la BCE (jour ou 90 jours) : <Cube time="…"><Cube currency="USD" rate="1.16"/>…"""
    root = ElementTree.fromstring(content)
    rows = []
    for day_cube in root.iter():
        time = day_cube.attrib.get("time")
        if not time:
            continue
        day = datetime.date.fromisoformat(time)
        for cube in day_cube:
            code = cube.attrib.get("currency", "").upper()
            rate = _rate(cube.attrib.get("rate"))
            if len(code) == 3 and rate is not None:
                rows.append((day, code, rate))
    return rows


def _download(url: str) -> bytes:
    response = requests.get(url, timeout=TIMEOUT, stream=True)
    response.raise_for_status()
    content = response.raw.read(MAX_BYTES + 1, decode_content=True)
    if len(content) > MAX_BYTES:
        raise ValueError("fichier trop volumineux")
    return content


def latest_date():
    return ExchangeRate.objects.aggregate(latest=Max("date"))["latest"]


def update_rates(force: bool = False, today: datetime.date | None = None) -> Update:
    """Ajoute les taux manquants depuis la BCE. Ne lève jamais : voir Update.error."""
    today = today or datetime.date.today()
    latest = latest_date()
    if not force:
        # Déjà à jour (le taux du jour n'arrive qu'à 16 h), ou vérifié il y a moins d'une heure
        if latest is not None and (today - latest).days <= 0:
            return Update(latest=latest)
        if not cache.add(CHECK_KEY, 1, CHECK_EVERY):
            return Update(latest=latest)
    full = latest is None or (today - latest).days > RECENT_DAYS
    try:
        content = _download(HISTORY_ZIP if full else LAST_90_DAYS)
    except Exception as exc:  # réseau, réponse HTTP en erreur
        logger.warning("Taux BCE injoignables : %s", exc.__class__.__name__)
        cache.delete(CHECK_KEY)
        return Update(latest=latest, error="fx_unreachable")
    try:
        rows = parse_history_zip(content) if full else parse_xml(content)
    except Exception as exc:  # fichier inattendu
        logger.warning("Fichier de taux BCE illisible : %s", exc.__class__.__name__)
        return Update(latest=latest, error="fx_invalid")
    before = ExchangeRate.objects.count()
    ExchangeRate.objects.bulk_create(
        [ExchangeRate(date=day, currency=code, rate=rate) for day, code, rate in rows if full or day > latest],
        ignore_conflicts=True,  # jours déjà en base
        batch_size=2000,
    )
    return Update(added=ExchangeRate.objects.count() - before, latest=latest_date(), source="history" if full else "recent")
