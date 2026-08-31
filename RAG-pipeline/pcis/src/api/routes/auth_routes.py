"""
Authentication API Routes — login, register, token refresh.
"""

from fastapi import APIRouter, Depends, HTTPException, status

from src.api.middleware.auth_middleware import get_auth_service, get_current_user
from src.api.schemas.api_schemas import (
    LoginRequest,
    RegisterRequest,
    TokenResponse,
    SuccessResponse,
)
from src.application.services.auth_service import AuthService
from src.domain.exceptions.domain_exceptions import (
    AuthenticationException,
    AccountLockedException,
)

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/login", response_model=TokenResponse)
async def login(
    request: LoginRequest,
    auth_service: AuthService = Depends(get_auth_service),
):
    """Authenticate and receive JWT tokens."""
    try:
        return await auth_service.authenticate(request.username, request.password)
    except AccountLockedException as e:
        raise HTTPException(status_code=status.HTTP_423_LOCKED, detail=e.message)
    except AuthenticationException as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail=e.message
        )


@router.post("/register", status_code=status.HTTP_201_CREATED)
async def register(
    request: RegisterRequest,
    current_user: dict = Depends(get_current_user),
    auth_service: AuthService = Depends(get_auth_service),
):
    """Register a new user (admin only)."""
    if current_user.get("role") != "ADMINISTRATOR":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators can register new users",
        )
    try:
        user_id = await auth_service.register_user(
            username=request.username,
            password=request.password,
            role_id=request.role_id,
            linked_officer_id=request.linked_officer_id,
            email=request.email,
        )
        return SuccessResponse(
            message="User registered successfully",
            data={"user_id": user_id},
        )
    except AuthenticationException as e:
        raise HTTPException(status_code=409, detail=e.message)


@router.get("/me")
async def get_me(current_user: dict = Depends(get_current_user)):
    """Get current authenticated user info."""
    return {
        "user_id": current_user.get("sub"),
        "username": current_user.get("username"),
        "role": current_user.get("role"),
        "officer_id": current_user.get("officer_id"),
    }
