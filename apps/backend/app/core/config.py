"""
Application settings and configuration.
"""

from typing import List

from pydantic import PostgresDsn, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # Project info
    PROJECT_NAME: str = "VentIA Backend API"
    VERSION: str = "0.1.0"
    API_V1_STR: str = "/api/v1"

    # Environment
    ENVIRONMENT: str = "development"
    LOG_LEVEL: str = "info"

    # Database
    DATABASE_URL: PostgresDsn

    # CORS
    CORS_ORIGINS: List[str] = ["http://localhost:3000"]

    # Security
    SECRET_KEY: str  # Used for encrypting sensitive data

    # Auth0
    AUTH0_DOMAIN: str
    AUTH0_AUDIENCE: str
    AUTH0_ISSUER: str
    AUTH0_ALGORITHM: str = "RS256"

    # eFact-OSE (Electronic Invoicing - Peru SUNAT)
    EFACT_BASE_URL: str = "https://ose-gw1.efact.pe:443/api-efact-ose"
    EFACT_RUC_VENTIA: str  # Required: RUC of Ventia for OAuth2 username
    EFACT_PASSWORD_REST: str  # Required: REST password for OAuth2 authentication
    EFACT_TOKEN_CACHE_HOURS: int = 1  # Token cache duration (eFact tokens last 12h)

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: str | List[str]) -> List[str]:
        """Convert string to list if needed for CORS origins."""
        if isinstance(v, str):
            # Handle JSON string format from .env: '["http://localhost:3000"]'
            import json
            try:
                return json.loads(v)
            except json.JSONDecodeError:
                # Handle comma-separated format: "http://localhost:3000,http://localhost:3001"
                return [i.strip() for i in v.split(",")]
        return v

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )


# Global settings instance
settings = Settings()
