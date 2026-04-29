# SPDX-License-Identifier: MIT
"""Behaviour tests for the rust-or-python wrapper."""

from app.services import document_processing as dp


def test_sha256_hex_known_vector():
    assert dp.sha256_hex(b"abc") == (
        "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
    )


def test_detect_script_latin():
    assert dp.detect_script("hello world", 1024) == "en"


def test_detect_script_arabic():
    assert dp.detect_script("مرحبا بالعالم", 1024) == "ar"


def test_detect_script_empty():
    assert dp.detect_script("", 1024) == "und"


def test_normalize_preserves_paragraphs():
    out = dp.normalize_document_text("Para one\n\n\n\nPara two")
    assert out == "Para one\n\nPara two"


def test_normalize_strips_control_chars():
    out = dp.normalize_document_text("hello\x00world")
    assert out == "helloworld"


def test_chunk_markdown_returns_one_when_small():
    chunks = dp.chunk_markdown("short doc", 1000)
    assert chunks == ["short doc"]


def test_chunk_markdown_splits_when_large():
    big = "## H\nparagraph.\n\n" * 200
    chunks = dp.chunk_markdown(big, 100)
    assert len(chunks) > 1
