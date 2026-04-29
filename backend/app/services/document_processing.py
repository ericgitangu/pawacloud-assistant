# SPDX-License-Identifier: MIT
"""Rust-or-Python fallback for document-pipeline text utilities.

Mirrors the pattern in text_processing.py: try to import the native
module, fall back to a pure-Python implementation for benchmarking and
deployments where the wheel isn't available.
"""

import hashlib
import logging
import re

logger = logging.getLogger(__name__)

__all__ = [
    "sha256_hex",
    "detect_script",
    "normalize_document_text",
    "chunk_markdown",
    "RUST_DOCUMENT_AVAILABLE",
]


# ── Python implementations (always available for benchmarking) ──────────


def _py_sha256_hex(data: bytes) -> str:
    """Hex-encoded SHA-256 of bytes.

    >>> _py_sha256_hex(b"abc")[:16]
    'ba7816bf8f01cfea'
    """
    return hashlib.sha256(data).hexdigest()


_LATIN = (0x0041, 0x024F)
_ARABIC_RANGES = ((0x0600, 0x06FF), (0x0750, 0x077F))
_CJK_RANGES = ((0x4E00, 0x9FFF), (0x3400, 0x4DBF))
_CYRILLIC = (0x0400, 0x04FF)
_DEVANAGARI = (0x0900, 0x097F)
_ETHIOPIC = (0x1200, 0x137F)


def _classify(cp: int) -> int:
    if _LATIN[0] <= cp <= _LATIN[1]:
        return 0
    if any(lo <= cp <= hi for lo, hi in _ARABIC_RANGES):
        return 1
    if any(lo <= cp <= hi for lo, hi in _CJK_RANGES):
        return 2
    if _CYRILLIC[0] <= cp <= _CYRILLIC[1]:
        return 3
    if _DEVANAGARI[0] <= cp <= _DEVANAGARI[1]:
        return 4
    if _ETHIOPIC[0] <= cp <= _ETHIOPIC[1]:
        return 5
    return -1


_TAGS = ("en", "ar", "zh", "ru", "hi", "am")


def _py_detect_script(text: str, sample_chars: int) -> str:
    """Detect a BCP-47 hint by Unicode block scan.

    >>> _py_detect_script("hello world", 1024)
    'en'
    >>> _py_detect_script("", 1024)
    'und'
    """
    counts = [0] * 6
    total = 0
    for ch in text[:sample_chars]:
        if not ch.isalpha():
            continue
        total += 1
        idx = _classify(ord(ch))
        if idx >= 0:
            counts[idx] += 1

    if total == 0:
        return "und"

    winner_idx, winner_count = max(enumerate(counts), key=lambda p: p[1])
    if winner_count * 100 // total < 60:
        return "und"
    return _TAGS[winner_idx]


_CONTROL = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")


def _py_normalize_document_text(raw: str) -> str:
    """Document-aware normalization preserving paragraph breaks.

    >>> _py_normalize_document_text("a\\r\\n\\r\\n\\r\\nb")
    'a\\n\\nb'
    >>> _py_normalize_document_text("foo   bar\\nbaz")
    'foo bar\\nbaz'
    """
    unified = raw.replace("\r\n", "\n").replace("\r", "\n")
    out: list[str] = []
    blank_streak = 0
    for line in unified.split("\n"):
        cleaned = _CONTROL.sub("", line)
        collapsed = " ".join(cleaned.split())
        if not collapsed:
            blank_streak += 1
            # invariant: emit at most one '\n' per blank-line run, and only
            # when content has already been written — mirrors Rust impl
            if blank_streak == 1 and out:
                out.append("")
        else:
            blank_streak = 0
            out.append(collapsed)

    return "\n".join(out).strip("\n")


def _py_estimate_tokens(text: str) -> int:
    chars = len(text)
    words = len(text.split())
    return (chars // 4 + words * 4 // 3) // 2


def _py_chunk_markdown(text: str, max_tokens: int) -> list[str]:
    """Token-budgeted markdown chunker.

    >>> _py_chunk_markdown("short", 100)
    ['short']
    """
    if _py_estimate_tokens(text) <= max_tokens:
        return [text]

    chunks: list[str] = []
    current = ""
    for block in text.split("\n\n"):
        if (
            current
            and _py_estimate_tokens(current) + _py_estimate_tokens(block) > max_tokens
        ):
            chunks.append(current.strip())
            current = ""
        if current:
            current += "\n\n"
        current += block

    if current.strip():
        chunks.append(current.strip())
    return chunks


# ── Select Rust or Python implementation ────────────────────────────────

try:
    from pawacloud_core import (
        chunk_markdown,
        detect_script,
        normalize_document_text,
        sha256_hex,
    )

    RUST_DOCUMENT_AVAILABLE = True
    logger.info("native rust document module loaded")
except ImportError:
    RUST_DOCUMENT_AVAILABLE = False
    logger.info("using python fallback for document processing")

    sha256_hex = _py_sha256_hex
    detect_script = _py_detect_script
    normalize_document_text = _py_normalize_document_text
    chunk_markdown = _py_chunk_markdown
