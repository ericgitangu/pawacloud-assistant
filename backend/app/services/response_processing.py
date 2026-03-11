"""Post-processing for LLM responses — Rust-accelerated with Python fallback."""

import logging
import re
from collections import Counter
from itertools import islice
from urllib.parse import urlparse

logger = logging.getLogger(__name__)

__all__ = ["format_sources", "truncate_response", "compute_similarity"]

_URL_PATTERN = re.compile(r"https?://[^\s\)>]+")

try:
    from pawacloud_core import format_sources, truncate_response, compute_similarity

    logger.info("rust response processing loaded")
except ImportError:
    logger.info("python fallback for response processing")

    def format_sources(text: str) -> list[str]:
        """Extract and deduplicate URLs, sorted by domain.

        >>> format_sources("See https://github.com/foo and https://github.com/bar")
        ['https://github.com/foo']
        >>> format_sources("no urls here")
        []
        """
        seen: set[str] = set()
        return sorted(
            (
                url
                for url in _URL_PATTERN.findall(text)
                if (parsed := urlparse(url)).netloc not in seen
                and not seen.add(parsed.netloc)
            ),
            key=lambda u: urlparse(u).netloc,
        )

    def truncate_response(text: str, max_tokens: int = 2048) -> str:
        """Token-aware truncation that doesn't break mid-sentence.

        >>> truncate_response("Short.", 2048)
        'Short.'
        >>> len(truncate_response(" ".join(["word"] * 5000), 100)) < 5000
        True
        """
        words = text.split()
        if len(words) * 4 // 3 <= max_tokens:
            return text
        kept = list(islice(words, max_tokens * 3 // 4))
        for i in range(len(kept) - 1, max(0, len(kept) - 20), -1):
            if kept[i].endswith((".", "!", "?")):
                return " ".join(kept[: i + 1])
        return " ".join(kept) + "..."

    def compute_similarity(a: str, b: str) -> float:
        """Jaccard similarity on word sets — used for history dedup.

        >>> compute_similarity("hello world", "hello world")
        1.0
        >>> compute_similarity("a b", "c d")
        0.0
        """
        words_a, words_b = Counter(a.lower().split()), Counter(b.lower().split())
        intersection = sum((words_a & words_b).values())
        union = sum((words_a | words_b).values())
        return intersection / union if union else 0.0
