"""
PCIS Application Settings

Environment-based configuration using pydantic-settings.
All settings are prefixed with PCIS_ and can be overridden via .env file.
"""

from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field


class Settings(BaseSettings):
    """Application-wide settings loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_prefix="PCIS_",
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ── Application ──────────────────────────────────────────────────────
    app_name: str = "PCIS"
    app_version: str = "1.0.0"
    app_env: str = "development"
    debug: bool = True
    host: str = "0.0.0.0"
    port: int = 8000

    # ── MongoDB ──────────────────────────────────────────────────────────
    db_host: str = "localhost"
    db_port: int = 27017
    db_name: str = "pcis"
    db_username: str = ""
    db_password: str = ""
    db_auth_source: str = "admin"

    # ── JWT Authentication ───────────────────────────────────────────────
    jwt_secret: str = "change-this-to-a-secure-random-string"
    jwt_algorithm: str = "HS256"
    jwt_access_token_expire_minutes: int = 60
    jwt_refresh_token_expire_days: int = 7

    # ── File Storage ─────────────────────────────────────────────────────
    storage_backend: str = "local"
    storage_local_path: str = "./storage/uploads"

    # ── Logging ──────────────────────────────────────────────────────────
    log_level: str = "INFO"
    log_format: str = "json"

    # ── CORS ─────────────────────────────────────────────────────────────
    cors_origins: List[str] = Field(
        default=["http://localhost:3000", "http://localhost:8000"]
    )

    @property
    def mongodb_uri(self) -> str:
        """Build MongoDB connection URI from components."""
        if self.db_username and self.db_password:
            return (
                f"mongodb://{self.db_username}:{self.db_password}"
                f"@{self.db_host}:{self.db_port}"
                f"/{self.db_name}?authSource={self.db_auth_source}"
            )
        return f"mongodb://{self.db_host}:{self.db_port}/{self.db_name}"

    @property
    def is_production(self) -> bool:
        return self.app_env == "production"


# Singleton instance
settings = Settings()
