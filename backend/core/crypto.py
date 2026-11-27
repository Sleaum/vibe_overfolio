"""
Chiffrement des secrets gardés en base : compte de service Google (googlesheet.SheetConfig) et jeton du mode 3
(accounts.GoogleAccount). Fernet (AES 128 + HMAC), de la bibliothèque cryptography.

Clés, de la plus prioritaire à la moins prioritaire :
- FIELD_ENCRYPTION_KEY : une clé Fernet, ou plusieurs séparées par des virgules (« nouvelle,ancienne ») pendant
  une rotation ;
- sinon, une clé dérivée de SECRET_KEY (HKDF-SHA256, avec un sel propre à cet usage) : chiffré sans rien régler.

On chiffre toujours avec la première clé. On déchiffre avec n'importe laquelle, y compris celles dérivées de
SECRET_KEY et de SECRET_KEY_FALLBACKS : ajouter FIELD_ENCRYPTION_KEY, ou changer SECRET_KEY en gardant l'ancienne
dans SECRET_KEY_FALLBACKS, ne rend rien illisible. `python manage.py rotate_encryption_key` rechiffre ensuite
tout avec la première clé (voir « Chiffrement des secrets » dans le README).
"""
import base64
import logging
import os
from typing import List

from cryptography.fernet import Fernet, InvalidToken, MultiFernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.hkdf import HKDF
from django.conf import settings

logger = logging.getLogger(__name__)

_SALT = b"overfolio.core.crypto"
_INFO = b"secrets en base"


class DecryptError(Exception):
    """Valeur chiffrée avec une clé qui n'est plus connue (clé changée sans être gardée pour le déchiffrement)."""


def explicit_keys() -> List[Fernet]:
    """Clés de FIELD_ENCRYPTION_KEY ; aucune si elle est vide ou si l'une d'elles n'est pas une clé Fernet."""
    raw = [key.strip() for key in os.getenv("FIELD_ENCRYPTION_KEY", "").split(",") if key.strip()]
    try:
        return [Fernet(key.encode()) for key in raw]
    except (ValueError, TypeError):
        logger.error("FIELD_ENCRYPTION_KEY n'est pas une clé Fernet valable (ou une liste de clés séparées par des virgules)")
        return []


def has_explicit_key() -> bool:
    """FIELD_ENCRYPTION_KEY est réglée et valable (le mode 3 l'exige)."""
    return bool(explicit_keys())


def _derived(secret: str) -> Fernet:
    key = HKDF(algorithm=hashes.SHA256(), length=32, salt=_SALT, info=_INFO).derive(secret.encode())
    return Fernet(base64.urlsafe_b64encode(key))


def derived_keys() -> List[Fernet]:
    """Clés dérivées de SECRET_KEY, puis de chaque ancienne clé de SECRET_KEY_FALLBACKS."""
    secrets = [settings.SECRET_KEY, *getattr(settings, "SECRET_KEY_FALLBACKS", [])]
    return [_derived(secret) for secret in secrets if secret]


def _keys() -> MultiFernet:
    return MultiFernet(explicit_keys() + derived_keys())


def encrypt(text: str) -> str:
    return _keys().encrypt(text.encode()).decode()


def decrypt(token: str) -> str:
    try:
        return _keys().decrypt(token.encode()).decode()
    except InvalidToken:
        raise DecryptError("Valeur chiffrée avec une clé inconnue.") from None


def rotate(token: str) -> str:
    """Même valeur, rechiffrée avec la première clé. Lève DecryptError si aucune clé connue ne la déchiffre."""
    try:
        return _keys().rotate(token.encode()).decode()
    except InvalidToken:
        raise DecryptError("Valeur chiffrée avec une clé inconnue.") from None
