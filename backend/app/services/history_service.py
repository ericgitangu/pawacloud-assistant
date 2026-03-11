"""Session-scoped conversation history — PostgreSQL with in-memory fallback."""

import logging
from collections import deque

from app.models.schemas import HistoryItem

logger = logging.getLogger(__name__)

_redis_client = None
_redis_checked = False


def get_redis():
    """Lazy Redis connection — returns None if unavailable."""
    global _redis_client, _redis_checked

    if _redis_checked:
        return _redis_client

    _redis_checked = True
    try:
        from app.core.config import get_settings
        import redis

        settings = get_settings()
        _redis_client = redis.from_url(
            settings.REDIS_URL,
            decode_responses=True,
            socket_connect_timeout=2,
        )
        _redis_client.ping()
        logger.info("redis connected at %s", settings.REDIS_URL)
    except Exception as exc:
        logger.info("redis unavailable: %s", exc)
        _redis_client = None

    return _redis_client


class HistoryStore:
    """
    Persists to PostgreSQL when DATABASE_URL is set. Falls back to
    in-memory deque when no database is available.
    """

    def __init__(self, *, max_items: int = 50):
        self._cache: dict[str, deque[HistoryItem]] = {}
        self._max_items = max_items

    def _get_deque(self, session_id: str) -> deque[HistoryItem]:
        if session_id not in self._cache:
            self._cache[session_id] = deque(maxlen=self._max_items)
        return self._cache[session_id]

    async def add(
        self, *, item: HistoryItem, session_id: str = "default"
    ) -> HistoryItem:
        dq = self._get_deque(session_id)
        dq.appendleft(item)

        from app.core.database import get_pool

        pool = get_pool()
        if pool:
            try:
                async with pool.acquire() as conn:
                    await conn.execute(
                        """INSERT INTO conversations (id, session_id, query, response, model, tokens_used, created_at)
                           VALUES ($1, $2, $3, $4, $5, $6, $7)""",
                        item.id,
                        session_id,
                        item.query,
                        item.response,
                        item.model,
                        item.tokens_used,
                        item.created_at,
                    )
            except Exception as exc:
                logger.debug("pg history write failed: %s", exc)

        return item

    async def get_page(
        self, limit: int = 20, offset: int = 0, session_id: str = "default"
    ) -> tuple[list[HistoryItem], int]:
        from app.core.database import get_pool

        pool = get_pool()
        if pool:
            try:
                async with pool.acquire() as conn:
                    rows = await conn.fetch(
                        """SELECT id, query, response, model, tokens_used, created_at
                           FROM conversations WHERE session_id = $1
                           ORDER BY created_at DESC LIMIT $2 OFFSET $3""",
                        session_id,
                        limit,
                        offset,
                    )
                    total = await conn.fetchval(
                        "SELECT COUNT(*) FROM conversations WHERE session_id = $1",
                        session_id,
                    )
                    items = [
                        HistoryItem(
                            id=r["id"],
                            query=r["query"],
                            response=r["response"],
                            model=r["model"] or "",
                            tokens_used=r["tokens_used"],
                            created_at=r["created_at"],
                        )
                        for r in rows
                    ]
                    return items, total
            except Exception as exc:
                logger.debug("pg history read failed: %s", exc)

        items = list(self._get_deque(session_id))
        return items[offset : offset + limit], len(items)

    async def remove(self, *, item_id: str, session_id: str = "default") -> bool:
        from app.core.database import get_pool
        import uuid

        pool = get_pool()
        if pool:
            try:
                async with pool.acquire() as conn:
                    result = await conn.execute(
                        "DELETE FROM conversations WHERE id = $1 AND session_id = $2",
                        uuid.UUID(item_id),
                        session_id,
                    )
                    deleted = result.split()[-1] != "0"
                    if deleted:
                        # evict from cache
                        dq = self._get_deque(session_id)
                        filtered = [h for h in dq if str(h.id) != item_id]
                        dq.clear()
                        for h in filtered:
                            dq.append(h)
                    return deleted
            except Exception as exc:
                logger.debug("pg history delete failed: %s", exc)

        dq = self._get_deque(session_id)
        original_len = len(dq)
        filtered = [h for h in dq if str(h.id) != item_id]
        if len(filtered) == original_len:
            return False
        dq.clear()
        for h in filtered:
            dq.append(h)
        return True

    async def clear(self, session_id: str = "default") -> int:
        from app.core.database import get_pool

        pool = get_pool()
        if pool:
            try:
                async with pool.acquire() as conn:
                    result = await conn.execute(
                        "DELETE FROM conversations WHERE session_id = $1", session_id
                    )
                    count = int(result.split()[-1])
                    self._get_deque(session_id).clear()
                    return count
            except Exception as exc:
                logger.debug("pg history clear failed: %s", exc)

        dq = self._get_deque(session_id)
        count = len(dq)
        dq.clear()
        return count

    # TODO: swap to Firestore if this outgrows a single Postgres instance

    def __len__(self) -> int:
        return sum(len(dq) for dq in self._cache.values())

    def __repr__(self) -> str:
        return f"HistoryStore(sessions={len(self._cache)}, total={len(self)})"


history_store = HistoryStore()
