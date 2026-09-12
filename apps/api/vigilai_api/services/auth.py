import re

from sqlalchemy.ext.asyncio import AsyncSession

from vigilai_api.core.exceptions import AuthenticationError, ValidationError
from vigilai_api.core.security import (
    create_access_token,
    create_refresh_token,
    get_password_hash,
    verify_password,
    verify_token,
)
from vigilai_api.db.models.user import User
from vigilai_api.repositories.user import UserRepository


class AuthService:
    def __init__(self, session: AsyncSession):
        self.repo = UserRepository(session)

    async def register(self, email: str, username: str, password: str) -> User:
        if not re.match(r"[^@]+@[^@]+\.[^@]+", email):
            raise ValidationError("Invalid email format")
        if len(password.encode()) > 72:
            raise ValidationError("Password must be at most 72 UTF-8 bytes")
        if len(password) < 8:
            raise ValidationError("Password must be at least 8 characters long")

        if await self.repo.exists(email):
            raise ValidationError("Email already registered")
        if await self.repo.get_by_username(username):
            raise ValidationError("Username already taken")

        hashed = get_password_hash(password)
        return await self.repo.create(email, username, hashed)

    async def login(self, email: str, password: str) -> tuple[str, str]:
        user = await self.repo.get_by_email(email)
        if not user or not user.is_active or not verify_password(password, user.hashed_password):
            raise AuthenticationError("Invalid email or password")

        access_token = create_access_token(str(user.id))
        refresh_token = create_refresh_token(str(user.id))
        return access_token, refresh_token

    async def refresh_token(self, refresh_token: str) -> tuple[str, str]:
        token_data = verify_token(refresh_token, token_type="refresh")
        if not token_data:
            raise AuthenticationError("Invalid refresh token")

        user = await self.repo.get_by_id(token_data.sub)
        if not user or not user.is_active:
            raise AuthenticationError("User not found or inactive")

        new_access = create_access_token(str(user.id))
        new_refresh = create_refresh_token(str(user.id))
        return new_access, new_refresh

    async def get_current_user(self, token: str) -> User:
        token_data = verify_token(token, token_type="access")
        if not token_data:
            raise AuthenticationError("Invalid token")

        user = await self.repo.get_by_id(token_data.sub)
        if not user or not user.is_active:
            raise AuthenticationError("User not found or inactive")
        return user

    async def logout(self) -> None:
        # JWT logout is stateless client-side (clear cookies), nothing to do on server
        pass
