from __future__ import annotations

import base64
import hashlib

from cryptography.fernet import Fernet

from .config import settings



def _derive_fernet_key(secret: str) -> bytes:
    digest = hashlib.sha256(secret.encode()).digest()
    return base64.urlsafe_b64encode(digest)


_cipher = Fernet(_derive_fernet_key(settings.refresh_token_key))


def encrypt_refresh_token(token: str) -> str:
    return _cipher.encrypt(token.encode()).decode()


def decrypt_refresh_token(ciphertext: str) -> str:
    return _cipher.decrypt(ciphertext.encode()).decode()
