from __future__ import annotations

from cryptography.fernet import Fernet

from .config import settings

_cipher = Fernet(settings.refresh_token_key.encode()[:32].ljust(32, b"0") if len(settings.refresh_token_key) >= 32 else settings.refresh_token_key.encode().ljust(32, b"0"))


def encrypt_refresh_token(token: str) -> str:
    return _cipher.encrypt(token.encode()).decode()


def decrypt_refresh_token(ciphertext: str) -> str:
    return _cipher.decrypt(ciphertext.encode()).decode()
