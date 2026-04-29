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

    # Document processing
    DOCUMENT_MAX_BYTES: int = Field(default=10 * 1024 * 1024)
    DOCUMENT_MAX_PAGES: int = Field(default=100)
    DOCUMENT_CACHE_TTL_PARSED: int = Field(
        default=86400
    )  # 24h Redis TTL for parsed text
    DOCUMENT_CACHE_TTL_OUTPUT: int = Field(
        default=604800
    )  # 7d Redis TTL for LLM outputs
    DOCUMENT_CHUNK_BUDGET: int = Field(default=80_000)  # max tokens per chunk
    DOCUMENT_SINGLE_PASS_LIMIT: int = Field(default=120_000)  # threshold for map-reduce
    DOCUMENT_OCR_CHAR_THRESHOLD: int = Field(
        default=40
    )  # chars/page below this → try OCR

    GOOGLE_VISION_KEY_PATH: str = Field(
        default="", description="Service account JSON path for Cloud Vision OCR"
    )

    MAX_QUERY_LENGTH: int = 2000
    MAX_HISTORY_ITEMS: int = 50

    # Redis — session cache (auth state, TTL'd JSON blobs)
    REDIS_URL: str = Field(
        default="redis://localhost:6379", description="Redis connection URL"
    )
    REDIS_TTL: int = Field(default=86400, description="Session TTL in seconds (24h)")

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
        default="change-me-in-prod", description="HMAC token signing secret"
    )
    OAUTH_REDIRECT_URI: str = Field(default="http://localhost:8000/auth/callback")
    FRONTEND_URL: str = Field(default="http://localhost:3000")

    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8",
        "case_sensitive": True,
        # tolerate stray vars from feature branches / deploy targets
        "extra": "ignore",
    }


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Singleton — avoids re-parsing env on every request."""
    return Settings()
