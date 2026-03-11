"""Application config — pydantic-settings loads from .env or environment."""

import logging
from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings

logger = logging.getLogger(__name__)


class Settings(BaseSettings):
    """Central config pulled from .env or env vars."""

    APP_TITLE: str = "PawaCloud Assistant API"
    APP_DESCRIPTION: str = (
        "AI-powered GCP advisory chatbot — Pawa IT Solutions technical assessment"
    )
    APP_VERSION: str = "1.0.0"

    # CORS — includes local + fly.io deployments
    ALLOWED_ORIGINS: list[str] = Field(
        default=[
            "http://localhost:3000",
            "https://pawacloud-web.fly.dev",
            "https://pawacloud.web.app",
        ]
    )

    GEMINI_API_KEY: str = Field(default="", description="Google Gemini API key")
    GEMINI_MODEL: str = Field(
        default="gemini-2.5-flash",
        description="Gemini model identifier",
    )

    MAX_QUERY_LENGTH: int = 2000
    MAX_HISTORY_ITEMS: int = 50

    # Redis — session storage + persistent history
    REDIS_URL: str = Field(
        default="redis://localhost:6379", description="Redis connection URL"
    )
    REDIS_TTL: int = Field(
        default=86400, description="Session/history TTL in seconds (24h)"
    )

    # PostgreSQL — user storage for email/password + OAuth account merging
    DATABASE_URL: str = Field(
        default="", description="PostgreSQL connection URL (empty = OAuth-only mode)"
    )

    # Google OAuth
    GOOGLE_CLIENT_ID: str = Field(default="", description="Google OAuth client ID")
    GOOGLE_CLIENT_SECRET: str = Field(
        default="", description="Google OAuth client secret"
    )
    SESSION_SECRET: str = Field(
        default="change-me-in-prod", description="Cookie signing secret"
    )
    OAUTH_REDIRECT_URI: str = Field(default="http://localhost:8000/auth/callback")
    FRONTEND_URL: str = Field(default="http://localhost:3000")

    # domain whitelist — employees skip signup, get a 60-min session
    GUEST_PASS_DOMAINS: list[str] = Field(
        default=["pawait.co.ke"],
        description="Email domains that get frictionless guest access",
    )
    GUEST_PASS_TTL: int = Field(
        default=3600, description="Guest pass session TTL in seconds (60 min)"
    )

    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8",
        "case_sensitive": True,
    }


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Singleton — avoids re-parsing env on every request."""
    return Settings()
