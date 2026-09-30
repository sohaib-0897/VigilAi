"""Tests for production deployment hardening: secret validation, cookie
security, and domain-derived CORS/frontend origins.

These exercise `vigilai_api.core.config.Settings` directly (not the cached
`get_settings()` singleton) so each test can construct its own combination
of ENVIRONMENT/SECRET_KEY/ENCRYPTION_KEY without interference. `_env_file=None`
isolates construction from any local `.env` a developer has on disk.
"""

import pytest
from cryptography.fernet import Fernet
from fastapi import Response
from pydantic import ValidationError
from vigilai_api.core.config import Settings

VALID_SECRET_KEY = "a" * 48  # 48 chars, well past the 32 char minimum
VALID_ENCRYPTION_KEY = Fernet.generate_key().decode()


def test_development_boots_with_insecure_defaults():
    """Local/dev must keep working with the documented placeholder defaults."""
    settings = Settings(_env_file=None, ENVIRONMENT="development")
    assert settings.SECRET_KEY.startswith("change-this")
    assert settings.COOKIE_SECURE is False


@pytest.mark.parametrize(
    "secret_key",
    [
        "change-this-to-a-random-secret-key-in-production",  # the compose default
        "changeme" * 5,
        "development" + "x" * 30,
        "short",  # too short regardless of content
    ],
)
def test_production_rejects_placeholder_or_short_secret_key(secret_key):
    with pytest.raises(ValidationError, match="SECRET_KEY"):
        Settings(
            _env_file=None,
            ENVIRONMENT="production",
            SECRET_KEY=secret_key,
            ENCRYPTION_KEY=VALID_ENCRYPTION_KEY,
        )


def test_production_rejects_placeholder_encryption_key():
    with pytest.raises(ValidationError, match="ENCRYPTION_KEY"):
        Settings(
            _env_file=None,
            ENVIRONMENT="production",
            SECRET_KEY=VALID_SECRET_KEY,
            ENCRYPTION_KEY="change-this-to-a-32-byte-base64-key",
        )


def test_production_rejects_invalid_fernet_key():
    """The compose default base64-decodes to 24 bytes, not the 32 Fernet
    requires, so it must fail even though it doesn't match a placeholder
    prefix after decoding."""
    with pytest.raises(ValidationError, match="ENCRYPTION_KEY"):
        Settings(
            _env_file=None,
            ENVIRONMENT="production",
            SECRET_KEY=VALID_SECRET_KEY,
            ENCRYPTION_KEY="Y2hhbmdlLXRoaXMtdG8tYS0zMi1ieXRl",
        )


def test_production_accepts_real_secrets():
    settings = Settings(
        _env_file=None,
        ENVIRONMENT="production",
        SECRET_KEY=VALID_SECRET_KEY,
        ENCRYPTION_KEY=VALID_ENCRYPTION_KEY,
    )
    assert settings.ENVIRONMENT == "production"
    assert settings.COOKIE_SECURE is True


def test_production_derives_cors_and_frontend_url_from_domain():
    settings = Settings(
        _env_file=None,
        ENVIRONMENT="production",
        SECRET_KEY=VALID_SECRET_KEY,
        ENCRYPTION_KEY=VALID_ENCRYPTION_KEY,
        DOMAIN="example.com",
    )
    assert settings.CORS_ORIGINS == ["https://example.com"]
    assert settings.FRONTEND_URL == "https://example.com"


def test_explicit_cors_origins_are_not_overridden_by_domain():
    settings = Settings(
        _env_file=None,
        ENVIRONMENT="production",
        SECRET_KEY=VALID_SECRET_KEY,
        ENCRYPTION_KEY=VALID_ENCRYPTION_KEY,
        DOMAIN="example.com",
        CORS_ORIGINS=["https://custom.example.org"],
    )
    assert settings.CORS_ORIGINS == ["https://custom.example.org"]


def test_cookie_secure_is_environment_aware():
    assert Settings(_env_file=None, ENVIRONMENT="development").COOKIE_SECURE is False
    assert (
        Settings(
            _env_file=None,
            ENVIRONMENT="production",
            SECRET_KEY=VALID_SECRET_KEY,
            ENCRYPTION_KEY=VALID_ENCRYPTION_KEY,
        ).COOKIE_SECURE
        is True
    )


def test_login_cookies_carry_secure_flag_only_in_production(monkeypatch):
    """Exercise the actual cookie-setting helper used by /login, /refresh and
    /logout, so a future change to auth.py can't silently drop the
    environment check tested above."""
    from vigilai_api.api.v1 import auth as auth_module

    dev_settings = Settings(_env_file=None, ENVIRONMENT="development")
    monkeypatch.setattr(auth_module, "settings", dev_settings)
    dev_response = Response()
    auth_module._set_auth_cookies(dev_response, "access", "refresh")
    dev_cookies = dev_response.headers.getlist("set-cookie")
    assert len(dev_cookies) == 2
    assert all("secure" not in c.lower() for c in dev_cookies)
    assert all("httponly" in c.lower() for c in dev_cookies)
    assert all("samesite=lax" in c.lower() for c in dev_cookies)

    prod_settings = Settings(
        _env_file=None,
        ENVIRONMENT="production",
        SECRET_KEY=VALID_SECRET_KEY,
        ENCRYPTION_KEY=VALID_ENCRYPTION_KEY,
    )
    monkeypatch.setattr(auth_module, "settings", prod_settings)
    prod_response = Response()
    auth_module._set_auth_cookies(prod_response, "access", "refresh")
    prod_cookies = prod_response.headers.getlist("set-cookie")
    assert len(prod_cookies) == 2
    assert all("secure" in c.lower() for c in prod_cookies)
    assert all("httponly" in c.lower() for c in prod_cookies)
