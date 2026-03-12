"""Reusable decorators for cross-cutting concerns."""

import logging
import time
from functools import wraps
from typing import Callable, ParamSpec, TypeVar

P = ParamSpec("P")
T = TypeVar("T")
logger = logging.getLogger(__name__)


def log_latency(func: Callable[P, T]) -> Callable[P, T]:
    """Log execution time for async route handlers."""

    @wraps(func)
    async def wrapper(*args: P.args, **kwargs: P.kwargs) -> T:
        start = time.monotonic()
        result = await func(*args, **kwargs)
        elapsed = (time.monotonic() - start) * 1000
        logger.info(f"{func.__name__} completed in {elapsed:.1f}ms")
        return result

    return wrapper
