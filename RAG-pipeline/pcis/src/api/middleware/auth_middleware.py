"""
Authentication middleware — extracts and validates JWT from requests.
"""

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from src.application.services.auth_service import AuthService
from src.infrastructure.database.mongodb.repositories import (
    MongoUserRepository,
    MongoRoleRepository,
)

security = HTTPBearer()


def get_auth_service() -> AuthService:
    """Dependency: auth service instance."""
    return AuthService(
        user_repo=MongoUserRepository(),
        role_repo=MongoRoleRepository(),
    )


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    auth_service: AuthService = Depends(get_auth_service),
) -> dict:
    """
    Dependency: extract and validate the current user from the JWT token.
    Returns the decoded token payload.
    """
    try:
        payload = auth_service.decode_token(credentials.credentials)
        if not payload.get("sub"):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication token",
            )
        return payload
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired authentication token",
            headers={"WWW-Authenticate": "Bearer"},
        )


def require_permission(resource: str, action: str):
    """
    Dependency factory: checks that the current user has a specific permission.
    Usage: Depends(require_permission("cases", "create"))
    """

    async def checker(
        current_user: dict = Depends(get_current_user),
        auth_service: AuthService = Depends(get_auth_service),
    ):
        role_repo = MongoRoleRepository()
        # Admins bypass permission checks
        if current_user.get("role") == "ADMINISTRATOR":
            return current_user

        role = await role_repo.get_by_name(current_user.get("role", ""))
        if not role:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Role not found",
            )

        permissions = role.get("permissions", {})
        resource_perms = permissions.get(resource, {})
        if not resource_perms.get(action, False):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Permission denied: {resource}.{action}",
            )

        return current_user

    return checker
