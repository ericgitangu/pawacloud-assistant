"""Health router — liveness, readiness, and diagnostic probes."""

import logging
import os
import time
from datetime import UTC, datetime

from fastapi import APIRouter

from app.core.config import get_settings
from app.services.text_processing import RUST_AVAILABLE
from app.core.events import EVENT_REGISTRY, event_counts

logger = logging.getLogger(__name__)
router = APIRouter()

_BOOT_TIME = time.monotonic()
_BOOT_TIMESTAMP = datetime.now(UTC)


@router.get("/health", summary="Health check", tags=["Health"])
async def health_check():
    settings = get_settings()
    return {
        "status": "healthy",
        "service": settings.APP_TITLE,
        "version": settings.APP_VERSION,
        "timestamp": datetime.now(UTC).isoformat(),
        "llm_provider": "Google Gemini",
        "llm_model": settings.GEMINI_MODEL,
        "rust_native": RUST_AVAILABLE,
    }


@router.get("/health/infra", summary="Infrastructure metadata", tags=["Health"])
async def infra_check():
    """Reads Fly.io / Cloud Run env vars when deployed, returns 'local' otherwise."""
    fly_app = os.environ.get("FLY_APP_NAME", "")
    fly_region = os.environ.get("FLY_REGION", "")
    fly_alloc = os.environ.get("FLY_ALLOC_ID", "")
    fly_image = os.environ.get("FLY_IMAGE_REF", "")

    k_service = os.environ.get("K_SERVICE", "")
    k_revision = os.environ.get("K_REVISION", "")

    if fly_app:
        env = "fly_io"
    elif k_service:
        env = "cloud_run"
    else:
        env = "local"

    return {
        "environment": env,
        "fly_io": {
            "app": fly_app or "unavailable",
            "region": fly_region or "unavailable",
            "alloc_id": fly_alloc[:12] if fly_alloc else "unavailable",
            "image": fly_image or "unavailable",
        },
        "cloud_run": {
            "service": k_service or "unavailable",
            "revision": k_revision or "unavailable",
        },
        "timestamp": datetime.now(UTC).isoformat(),
    }


@router.get("/health/llm", summary="Test Gemini connectivity", tags=["Health"])
async def llm_health():
    """Minimal generation to verify the API key works. Only call from status page."""
    settings = get_settings()

    if not settings.GEMINI_API_KEY:
        return {
            "status": "degraded",
            "model": settings.GEMINI_MODEL,
            "detail": "GEMINI_API_KEY not configured",
        }

    try:
        from app.services.llm_service import get_llm_client

        client = get_llm_client()
        text, model_name, token_count = await client.generate("Reply with exactly: OK")
        return {
            "status": "operational",
            "model": model_name,
            "tokens_used": token_count,
            "response": text.strip()[:20],
        }
    except Exception as exc:
        logger.warning("llm health check failed: %s", exc)
        return {
            "status": "degraded",
            "model": settings.GEMINI_MODEL,
            "detail": str(exc)[:200],
        }


@router.get("/health/events", summary="Event registry introspection", tags=["Health"])
async def events_registry():
    """Lists every event code the document pipeline can emit, with descriptions."""
    return {
        "registered": [str(code) for code in EVENT_REGISTRY],
        "descriptions": {str(code): desc for code, desc in EVENT_REGISTRY.items()},
        "counts_since_start": event_counts(),
    }


@router.get("/health/metrics", summary="Backend performance metrics", tags=["Health"])
async def metrics():
    """PyO3 vs Python benchmarks, service uptime, and Redis health."""
    uptime_secs = time.monotonic() - _BOOT_TIME

    # benchmark PyO3 vs Python fallback
    benchmarks = _run_pyo3_benchmarks()

    # redis health
    redis_info = _redis_metrics()

    pg_info = await _pg_metrics()

    events_block = {
        "registered": [str(code) for code in EVENT_REGISTRY],
        "counts_since_start": event_counts(),
    }

    return {
        "uptime_seconds": round(uptime_secs, 1),
        "boot_time": _BOOT_TIMESTAMP.isoformat(),
        "rust_native": RUST_AVAILABLE,
        "benchmarks": benchmarks,
        "events": events_block,
        "redis": redis_info,
        "postgres": pg_info,
        "timestamp": datetime.now(UTC).isoformat(),
    }


def _run_pyo3_benchmarks() -> list[dict]:
    """Measure text processing functions — Rust vs Python when both are available."""
    import time as _time

    from app.services import text_processing
    from app.services.text_processing import (
        _py_sanitize_input,
        _py_estimate_tokens,
        _py_validate_markdown,
        _py_extract_code_blocks,
    )

    test_payloads = {
        "sanitize_input": (
            "Hello <script>alert('xss')</script> world! " * 20,
            _py_sanitize_input,
        ),
        "estimate_tokens": (
            "The quick brown fox jumps over the lazy dog. " * 100,
            _py_estimate_tokens,
        ),
        "validate_markdown": (
            "# Heading\n\n- item 1\n- item 2\n\n```python\nprint('hello')\n```\n" * 10,
            _py_validate_markdown,
        ),
        "extract_code_blocks": (
            "# Example\n```python\nprint('hello')\n```\n\nSome text\n```js\nconsole.log('hi')\n```\n"
            * 5,
            _py_extract_code_blocks,
        ),
    }

    iterations = 1000
    results = []

    for fn_name, (payload, py_fn) in test_payloads.items():
        try:
            active_fn = getattr(text_processing, fn_name)

            # benchmark active implementation (rust or python)
            start = _time.perf_counter()
            for _ in range(iterations):
                active_fn(payload)
            active_us = ((_time.perf_counter() - start) / iterations) * 1_000_000

            entry = {
                "function": fn_name,
                "backend": "rust_pyo3" if RUST_AVAILABLE else "python",
                "avg_us": round(active_us, 2),
                "payload_bytes": len(payload.encode()),
                "iterations": iterations,
            }

            # benchmark python fallback for comparison when rust is active
            if RUST_AVAILABLE:
                start = _time.perf_counter()
                for _ in range(iterations):
                    py_fn(payload)
                py_us = ((_time.perf_counter() - start) / iterations) * 1_000_000

                entry["python_avg_us"] = round(py_us, 2)
                entry["speedup"] = f"{py_us / active_us:.1f}x" if active_us > 0 else "∞"

            results.append(entry)
        except Exception as exc:
            results.append({"function": fn_name, "error": str(exc)[:100]})

    from app.services import document_processing
    from app.services.document_processing import (
        _py_sha256_hex,
        _py_detect_script,
        _py_normalize_document_text,
        _py_chunk_markdown,
    )

    document_payloads = {
        "sha256_hex": (b"The quick brown fox " * 500, _py_sha256_hex),
        "detect_script": (
            "hello world this is a sample document " * 50,
            _py_detect_script,
        ),
        "normalize_document_text": (
            "Para one with text.\n\n\nPara two with more text.\n" * 30,
            _py_normalize_document_text,
        ),
        "chunk_markdown": (
            "## Heading\n\nParagraph content here.\n\n" * 40,
            _py_chunk_markdown,
        ),
    }

    for fn_name, (payload, py_fn) in document_payloads.items():
        try:
            active_fn = getattr(document_processing, fn_name)

            extra_args: tuple = ()
            if fn_name == "detect_script":
                extra_args = (1024,)
            elif fn_name == "chunk_markdown":
                extra_args = (200,)

            start = _time.perf_counter()
            for _ in range(iterations):
                active_fn(payload, *extra_args)
            active_us = ((_time.perf_counter() - start) / iterations) * 1_000_000

            entry = {
                "function": fn_name,
                "backend": "rust_pyo3"
                if document_processing.RUST_DOCUMENT_AVAILABLE
                else "python",
                "avg_us": round(active_us, 2),
                "payload_bytes": len(payload)
                if isinstance(payload, bytes)
                else len(payload.encode()),
                "iterations": iterations,
            }

            if document_processing.RUST_DOCUMENT_AVAILABLE:
                start = _time.perf_counter()
                for _ in range(iterations):
                    py_fn(payload, *extra_args)
                py_us = ((_time.perf_counter() - start) / iterations) * 1_000_000

                entry["python_avg_us"] = round(py_us, 2)
                entry["speedup"] = f"{py_us / active_us:.1f}x" if active_us > 0 else "∞"

            results.append(entry)
        except Exception as exc:
            results.append({"function": fn_name, "error": str(exc)[:100]})

    return results


async def _pg_metrics() -> dict:
    """Pull basic stats from PostgreSQL if available."""
    try:
        from app.core.database import get_pool

        pool = get_pool()
        if not pool:
            return {"status": "unavailable"}

        async with pool.acquire() as conn:
            version = await conn.fetchval("SELECT version()")
            db_size = await conn.fetchval(
                "SELECT pg_size_pretty(pg_database_size(current_database()))"
            )
            conversation_count = await conn.fetchval(
                "SELECT COUNT(*) FROM conversations"
            )
            user_count = await conn.fetchval("SELECT COUNT(*) FROM users")
            pool_size = pool.get_size()
            pool_free = pool.get_idle_size()

        return {
            "status": "connected",
            "version": version.split(",")[0] if version else "unknown",
            "database_size": db_size,
            "conversations": conversation_count,
            "users": user_count,
            "pool_size": pool_size,
            "pool_idle": pool_free,
        }
    except Exception:
        return {"status": "unavailable"}


def _redis_metrics() -> dict:
    """Pull connection stats from Redis if available."""
    try:
        from app.services.history_service import get_redis

        r = get_redis()
        if not r:
            return {"status": "unavailable"}

        info = r.info(section="server")
        memory = r.info(section="memory")
        keys = r.info(section="keyspace")

        return {
            "status": "connected",
            "version": info.get("redis_version", "unknown"),
            "uptime_seconds": info.get("uptime_in_seconds", 0),
            "used_memory_mb": round(memory.get("used_memory", 0) / 1024 / 1024, 2),
            "connected_clients": info.get("connected_clients", 0),
            "total_keys": sum(
                db.get("keys", 0) for db in keys.values() if isinstance(db, dict)
            ),
        }
    except Exception:
        return {"status": "unavailable"}
