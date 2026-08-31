"""
Authentication Service — JWT-based authentication and authorization.
"""

import logging
from datetime import datetime, timedelta
from typing import Any, Dict, Optional

from jose import JWTError, jwt
from passlib.context import CryptContext

from src.application.interfaces.repositories import UserRepository, RoleRepository
from src.config.settings import settings
from src.domain.exceptions.domain_exceptions import (
    AuthenticationException,
    AccountLockedException,
)

logger = logging.getLogger(__name__)

MAX_FAILED_ATTEMPTS = 5

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


class AuthService:
    """Handles user authentication, token generation, and password management."""

    def __init__(self, user_repo: UserRepository, role_repo: RoleRepository):
        self.user_repo = user_repo
        self.role_repo = role_repo

    @staticmethod
    def hash_password(password: str) -> str:
        """Hash a plaintext password."""
        return pwd_context.hash(password)

    @staticmethod
    def verify_password(plain: str, hashed: str) -> bool:
        """Verify a password against its hash."""
        return pwd_context.verify(plain, hashed)

    @staticmethod
    def create_access_token(
        data: Dict[str, Any], expires_delta: timedelta | None = None
    ) -> str:
        """Generate a JWT access token."""
        to_encode = data.copy()
        expire = datetime.utcnow() + (
            expires_delta
            or timedelta(minutes=settings.jwt_access_token_expire_minutes)
        )
        to_encode.update({"exp": expire, "type": "access"})
        return jwt.encode(
            to_encode, settings.jwt_secret, algorithm=settings.jwt_algorithm
        )

    @staticmethod
    def create_refresh_token(data: Dict[str, Any]) -> str:
        """Generate a JWT refresh token."""
        to_encode = data.copy()
        expire = datetime.utcnow() + timedelta(
            days=settings.jwt_refresh_token_expire_days
        )
        to_encode.update({"exp": expire, "type": "refresh"})
        return jwt.encode(
            to_encode, settings.jwt_secret, algorithm=settings.jwt_algorithm
        )

    @staticmethod
    def decode_token(token: str) -> Dict[str, Any]:
        """Decode and validate a JWT token."""
        try:
            payload = jwt.decode(
                token, settings.jwt_secret, algorithms=[settings.jwt_algorithm]
            )
            return payload
        except JWTError as e:
            raise AuthenticationException(f"Invalid token: {e}")

    async def authenticate(
        self, username: str, password: str
    ) -> Dict[str, Any]:
        """
        Authenticate user credentials and return tokens.
        Enforces account lockout after MAX_FAILED_ATTEMPTS.
        """
        user = await self.user_repo.get_by_username(username)
        if not user:
            raise AuthenticationException("Invalid username or password")

        # Check if account is locked
        if user.get("account_status") == "LOCKED":
            raise AccountLockedException(username)

        if user.get("account_status") != "ACTIVE":
            raise AuthenticationException(
                f"Account is {user.get('account_status', 'inactive')}"
            )

        # Verify password
        if not self.verify_password(password, user["password_hash"]):
            failed = user.get("failed_login_attempts", 0) + 1
            update: Dict[str, Any] = {"failed_login_attempts": failed}

            if failed >= MAX_FAILED_ATTEMPTS:
                update["account_status"] = "LOCKED"
                logger.warning(f"Account locked due to {failed} failed attempts: {username}")

            await self.user_repo.update(user["user_id"], update)
            raise AuthenticationException("Invalid username or password")

        # Success: reset failed attempts and update last login
        now = datetime.utcnow()
        await self.user_repo.update(user["user_id"], {
            "failed_login_attempts": 0,
            "last_login_at": now,
        })

        # Fetch role for permissions
        role = await self.role_repo.get_by_id(user["role_id"])

        token_data = {
            "sub": user["user_id"],
            "username": user["username"],
            "role": role["role_name"] if role else "UNKNOWN",
            "officer_id": user.get("linked_officer_id"),
        }

        return {
            "access_token": self.create_access_token(token_data),
            "refresh_token": self.create_refresh_token({"sub": user["user_id"]}),
            "token_type": "bearer",
            "user": {
                "user_id": user["user_id"],
                "username": user["username"],
                "role": role["role_name"] if role else "UNKNOWN",
                "permissions": role["permissions"] if role else {},
            },
        }

    async def register_user(
        self,
        username: str,
        password: str,
        role_id: str,
        linked_officer_id: str | None = None,
        email: str | None = None,
    ) -> str:
        """Register a new user account."""
        # Check for duplicate username
        existing = await self.user_repo.get_by_username(username)
        if existing:
            raise AuthenticationException(f"Username already exists: {username}")

        now = datetime.utcnow()
        user_data = {
            "username": username,
            "password_hash": self.hash_password(password),
            "role_id": role_id,
            "linked_officer_id": linked_officer_id,
            "email": email,
            "account_status": "ACTIVE",
            "failed_login_attempts": 0,
            "password_changed_at": now,
            "created_at": now,
            "updated_at": now,
        }

        user_id = await self.user_repo.create(user_data)
        logger.info(f"User registered: {username} (ID: {user_id})")
        return user_id
