"""VigilAI Security Module"""

import urllib.parse
from datetime import UTC, datetime, timedelta
from typing import Any

import bcrypt
from cryptography.fernet import Fernet
from jose import JWTError, jwt
from pydantic import BaseModel

from vigilai_api.core.config import get_settings

settings = get_settings()


# Initialize Fernet for encryption (padding key if necessary)
# Key must be 32 bytes base64 encoded.
try:
    _fernet = Fernet(settings.ENCRYPTION_KEY.encode())
except ValueError:
    _fernet = None


class TokenPayload(BaseModel):
    sub: str
    exp: int
    type: str


def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return bcrypt.checkpw(plain_password.encode(), hashed_password.encode())
    except ValueError:
        return False


def get_password_hash(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def create_access_token(subject: str | Any, expires_delta: timedelta | None = None) -> str:
    if expires_delta:
        expire = datetime.now(UTC) + expires_delta
    else:
        expire = datetime.now(UTC) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode = {"exp": expire, "sub": str(subject), "type": "access"}
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm="HS256")
    return encoded_jwt


def create_refresh_token(subject: str | Any, expires_delta: timedelta | None = None) -> str:
    if expires_delta:
        expire = datetime.now(UTC) + expires_delta
    else:
        expire = datetime.now(UTC) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode = {"exp": expire, "sub": str(subject), "type": "refresh"}
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm="HS256")
    return encoded_jwt


def verify_token(token: str, token_type: str = "access") -> TokenPayload | None:
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
        token_data = TokenPayload(**payload)
        if token_data.type != token_type:
            return None
        return token_data
    except (JWTError, ValueError):
        return None


def encrypt_string(plaintext: str) -> str:
    """Encrypt sensitive string like RTSP credentials."""
    if _fernet is None:
        raise ValueError("Configure a valid persistent ENCRYPTION_KEY before adding RTSP cameras")
    return _fernet.encrypt(plaintext.encode()).decode()


def decrypt_string(ciphertext: str) -> str:
    """Decrypt sensitive string."""
    if _fernet is None:
        raise ValueError("ENCRYPTION_KEY is not configured")
    return _fernet.decrypt(ciphertext.encode()).decode()


def sanitize_uri(uri: str) -> str:
    """Redact passwords from URIs (e.g., RTSP)."""
    try:
        parsed = urllib.parse.urlparse(uri)
        if parsed.password:
            netloc = parsed.netloc.replace(f":{parsed.password}@", ":****@")
            return urllib.parse.urlunparse(parsed._replace(netloc=netloc))
        return uri
    except Exception:
        return uri
