from fastapi import APIRouter, Depends, Request, Response
from sqlalchemy.ext.asyncio import AsyncSession

from vigilai_api.core.config import get_settings
from vigilai_api.core.deps import get_db, require_auth
from vigilai_api.core.exceptions import AuthenticationError
from vigilai_api.db.models.user import User
from vigilai_api.schemas.auth import LoginRequest, RegisterRequest, TokenResponse, UserResponse
from vigilai_api.services.auth import AuthService

settings = get_settings()
router = APIRouter()


@router.post("/register", response_model=UserResponse)
async def register(user_in: RegisterRequest, db: AsyncSession = Depends(get_db)):
    service = AuthService(db)
    user = await service.register(user_in.email, user_in.username, user_in.password)
    return user


@router.post("/login", response_model=TokenResponse)
async def login(user_in: LoginRequest, response: Response, db: AsyncSession = Depends(get_db)):
    service = AuthService(db)
    access_token, refresh_token = await service.login(user_in.email, user_in.password)

    # Set HttpOnly cookie
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        samesite="lax",
        secure=settings.ENVIRONMENT == "production",  # ideally check environment
    )

    response.set_cookie(
        "refresh_token",
        refresh_token,
        httponly=True,
        samesite="lax",
        secure=settings.ENVIRONMENT == "production",
        path="/api/v1/auth",
    )
    return {"access_token": access_token, "token_type": "bearer"}


@router.post("/refresh", response_model=TokenResponse)
async def refresh(request: Request, response: Response, db: AsyncSession = Depends(get_db)):
    # In a real app we might use a separate refresh_token cookie
    # or pass it in body. For now, assume it's sent in a cookie or header.
    # Let's just expect it in an auth header for simplicity if cookie not used
    # This matches the basic setup.
    token = request.cookies.get("refresh_token") or request.headers.get(
        "Authorization", ""
    ).replace("Bearer ", "")
    if not token:
        raise AuthenticationError("Refresh token missing")

    service = AuthService(db)
    new_access, new_refresh = await service.refresh_token(token)

    response.set_cookie(
        key="access_token",
        value=new_access,
        httponly=True,
        samesite="lax",
        secure=settings.ENVIRONMENT == "production",
    )
    response.set_cookie(
        "refresh_token",
        new_refresh,
        httponly=True,
        samesite="lax",
        secure=settings.ENVIRONMENT == "production",
        path="/api/v1/auth",
    )
    return {"access_token": new_access, "token_type": "bearer"}


@router.post("/logout")
async def logout(response: Response):
    response.delete_cookie(
        key="access_token",
        httponly=True,
        samesite="lax",
        secure=settings.ENVIRONMENT == "production",
    )
    response.delete_cookie("refresh_token", path="/api/v1/auth")
    return {"msg": "Logged out successfully"}


@router.get("/me", response_model=UserResponse)
async def me(current_user: User = Depends(require_auth)):
    return current_user
