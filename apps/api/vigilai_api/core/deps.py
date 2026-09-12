"""VigilAI Dependencies"""

from collections.abc import AsyncGenerator

import redis.asyncio as redis
from fastapi import Depends, Request
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession

from vigilai_api.core.config import get_settings
from vigilai_api.core.exceptions import AuthenticationError
from vigilai_api.core.security import verify_token
from vigilai_api.db.models.user import User
from vigilai_api.db.session import async_session_maker

settings = get_settings()

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/v1/auth/login", auto_error=False)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Dependency for async database session."""
    async with async_session_maker() as session:
        yield session


async def get_redis() -> AsyncGenerator[redis.Redis, None]:
    """Dependency for Redis connection."""
    client = redis.from_url(settings.REDIS_URL, decode_responses=True)
    try:
        yield client
    finally:
        await client.aclose()


async def get_current_user(
    request: Request, db: AsyncSession = Depends(get_db), token: str | None = Depends(oauth2_scheme)
) -> User:
    """Extract and validate JWT from HttpOnly cookie or Bearer token."""
    # Check cookie first, fallback to header
    auth_token = request.cookies.get("access_token")
    if not auth_token and token:
        auth_token = token

    if not auth_token:
        raise AuthenticationError("Not authenticated")

    # Remove 'Bearer ' prefix if present
    if auth_token.startswith("Bearer "):
        auth_token = auth_token.split(" ")[1]

    token_data = verify_token(auth_token, token_type="access")
    if not token_data:
        raise AuthenticationError("Invalid token or token expired")

    # Fetch user
    # Need to query the DB (simple fetch)
    from sqlalchemy import select

    result = await db.execute(select(User).where(User.id == token_data.sub))
    user = result.scalars().first()

    if not user:
        raise AuthenticationError("User not found")
    if not user.is_active:
        raise AuthenticationError("Inactive user")

    return user


async def require_auth(current_user: User = Depends(get_current_user)) -> User:
    """Dependency that ensures the user is authenticated."""
    return current_user
