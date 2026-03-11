"""Rust PyO3 bindings with Python fallback — input sanitization and validation."""

import logging
import re

logger = logging.getLogger(__name__)

__all__ = [
    "sanitize_input",
    "estimate_tokens",
    "validate_markdown",
    "extract_code_blocks",
    "RUST_AVAILABLE",
]

_CONTROL_CHARS = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")
_DANGEROUS = frozenset({"<script", "javascript:", "onerror=", "onload="})

try:
    from pawacloud_core import (
        sanitize_input,
        estimate_tokens,
        validate_markdown,
        extract_code_blocks,
    )

    RUST_AVAILABLE = True
    logger.info("native rust module loaded")
except ImportError:
    RUST_AVAILABLE = False
    logger.info("using python fallback for text processing")

    def sanitize_input(text: str) -> str:
        """Strip control characters and normalize whitespace.

        >>> sanitize_input("hello\\x00world")
        'helloworld'
        >>> sanitize_input("  foo   bar  ")
        'foo bar'
        """
        cleaned = _CONTROL_CHARS.sub("", text)
        return " ".join(cleaned.split()).strip()

    def estimate_tokens(text: str) -> int:
        """Approximate token count — max of char/4 and word count.

        >>> estimate_tokens("hello world")
        2
        >>> estimate_tokens("")
        0
        """
        return max(len(text) // 4, len(text.split()))

    def validate_markdown(text: str) -> bool:
        """Reject markdown with script injection patterns.

        >>> validate_markdown("# Safe heading")
        True
        >>> validate_markdown("<script>alert(1)</script>")
        False
        """
        lower = text.lower()
        return not any(p in lower for p in _DANGEROUS)

    def extract_code_blocks(text: str) -> list[tuple[str, str]]:
        """Pull fenced code blocks as (language, code) tuples.

        >>> extract_code_blocks("```python\\nprint('hi')\\n```")
        [('python', "print('hi')")]
        """
        # TODO: benchmark Rust vs Python fallback and log delta in health endpoint
        return re.findall(r"```(\w*)\n(.*?)```", text, re.DOTALL)
