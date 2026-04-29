"""PostgreSQL connection pool for user storage."""

import logging

import asyncpg

from app.core.config import get_settings

logger = logging.getLogger(__name__)

_pool: asyncpg.Pool | None = None


async def init_db():
    """Create connection pool and ensure users table exists."""
    global _pool
    settings = get_settings()

    if not settings.DATABASE_URL:
        logger.info("DATABASE_URL not set — user storage disabled, OAuth-only auth")
        return

    try:
        _pool = await asyncpg.create_pool(
            settings.DATABASE_URL,
            min_size=2,
            max_size=10,
            command_timeout=10,
        )

        async with _pool.acquire() as conn:
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS users (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    email TEXT UNIQUE NOT NULL,
                    name TEXT NOT NULL DEFAULT '',
                    picture TEXT DEFAULT '',
                    password_hash TEXT,
                    provider TEXT DEFAULT 'email',
                    created_at TIMESTAMPTZ DEFAULT now(),
                    updated_at TIMESTAMPTZ DEFAULT now()
                )
            """)
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS conversations (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    session_id TEXT NOT NULL,
                    query TEXT NOT NULL,
                    response TEXT NOT NULL,
                    model TEXT DEFAULT '',
                    tokens_used INTEGER,
                    created_at TIMESTAMPTZ DEFAULT now()
                )
            """)
            await conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_conversations_session
                ON conversations (session_id, created_at DESC)
            """)
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS artifacts (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    sha256 CHAR(64) NOT NULL,
                    owner_email TEXT NOT NULL,
                    filename TEXT NOT NULL,
                    mime TEXT NOT NULL,
                    byte_size INTEGER NOT NULL,
                    page_count INTEGER NOT NULL,
                    char_count INTEGER NOT NULL,
                    source_lang TEXT,
                    parsed_text TEXT NOT NULL,
                    parse_method TEXT NOT NULL,
                    warnings JSONB DEFAULT '[]'::jsonb,
                    created_at TIMESTAMPTZ DEFAULT now()
                )
            """)
            await conn.execute("""
                CREATE UNIQUE INDEX IF NOT EXISTS idx_artifacts_owner_sha
                ON artifacts (owner_email, sha256)
            """)
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS artifact_outputs (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    artifact_id UUID NOT NULL REFERENCES artifacts(id) ON DELETE CASCADE,
                    action TEXT NOT NULL,
                    target_lang TEXT NOT NULL,
                    content TEXT NOT NULL,
                    model TEXT NOT NULL,
                    tokens_used INTEGER,
                    created_at TIMESTAMPTZ DEFAULT now()
                )
            """)
            await conn.execute("""
                CREATE UNIQUE INDEX IF NOT EXISTS idx_outputs_artifact_action_lang
                ON artifact_outputs (artifact_id, action, target_lang)
            """)
            await conn.execute("""
                ALTER TABLE conversations
                ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'chat'
            """)
            await conn.execute("""
                ALTER TABLE conversations
                ADD COLUMN IF NOT EXISTS artifact_id UUID REFERENCES artifacts(id) ON DELETE SET NULL
            """)

        logger.info(
            "postgres connected, schema ready (users + conversations + artifacts)"
        )
    except Exception as exc:
        logger.warning("postgres unavailable — email/password auth disabled: %s", exc)
        _pool = None


async def close_db():
    global _pool
    if _pool:
        await _pool.close()
        _pool = None


def get_pool() -> asyncpg.Pool | None:
    return _pool
