# SPDX-License-Identifier: MIT
"""Event registry + emit_event for the document pipeline."""

import logging
from collections import Counter
from enum import StrEnum

from starlette.requests import Request

logger = logging.getLogger(__name__)


class EventCode(StrEnum):
    PARSED = "parsed"
    CACHE_HIT = "cache_hit"
    CHUNK = "chunk"
    PROGRESS = "progress"
    DONE = "done"
    ERROR = "error"


EVENT_REGISTRY: dict[EventCode, str] = {
    EventCode.PARSED: "Document parsed; emits token + chunk count",
    EventCode.CACHE_HIT: "Cached output returned; no LLM call made",
    EventCode.CHUNK: "Streamed markdown fragment from the LLM",
    EventCode.PROGRESS: "Map-reduce phase update (>120k token docs)",
    EventCode.DONE: "Stream complete; emits final token count",
    EventCode.ERROR: "Generic error envelope; details in server logs",
}

# in-memory counter — reset on process restart, exposed via /health/metrics
_counter: Counter[str] = Counter()


def emit_event(request: Request | None, code: EventCode, **fields) -> dict:
    """Record event for telemetry and return its JSON wire shape."""
    if code not in EVENT_REGISTRY:
        raise ValueError(f"unregistered event code: {code}")

    _counter[str(code)] += 1

    extra = {
        "event_code": str(code),
        "session_id": getattr(request.state, "session_id", None) if request else None,
        "user_email": (getattr(request.state, "user", None) or {}).get("email")
        if request
        else None,
    }
    if request:
        extra["trace"] = request.headers.get("x-cloud-trace-context")
    extra.update(fields)
    logger.info("doc.event", extra=extra)

    return {"type": str(code), **fields}


def event_counts() -> dict[str, int]:
    """Snapshot of cumulative counts since process start."""
    return {code: _counter.get(code, 0) for code in EVENT_REGISTRY}
