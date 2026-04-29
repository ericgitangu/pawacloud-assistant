# SPDX-License-Identifier: MIT
"""Behaviour tests for the rust-or-python wrapper and document parse pipeline."""

from pathlib import Path
from unittest.mock import patch

import pytest

from app.services import document_processing as dp
from app.services.document_service import parse_document

FIXTURES = Path(__file__).parent / "fixtures"


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


# ── document_service parse pipeline tests ───────────────────────────────


def test_parse_docx_returns_text_and_metadata():
    raw = (FIXTURES / "sample.docx").read_bytes()
    parsed = parse_document(
        raw,
        "sample.docx",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    )
    assert parsed.parse_method == "docx"
    assert "first paragraph" in parsed.text.lower()
    assert parsed.page_count >= 1
    assert parsed.char_count > 0


def test_parse_pdf_text_layer():
    raw = (FIXTURES / "sample.pdf").read_bytes()
    parsed = parse_document(raw, "sample.pdf", "application/pdf")
    assert parsed.parse_method == "pdf-text"
    assert "sample pdf" in parsed.text.lower()
    assert parsed.page_count == 1


def test_parse_unsupported_mime_raises():
    with pytest.raises(ValueError, match="unsupported"):
        parse_document(b"", "x.txt", "text/plain")


def test_pdf_falls_back_to_ocr_warning_when_vision_unavailable():
    # zero-text pdf payload — pdf-empty branch
    minimal_empty_pdf = (
        b"%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n"
        b"2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n"
        b"3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]>>endobj\n"
        b"xref\n0 4\n0000000000 65535 f \n"
        b"0000000009 00000 n \n0000000055 00000 n \n0000000101 00000 n \n"
        b"trailer<</Size 4/Root 1 0 R>>\nstartxref\n160\n%%EOF\n"
    )

    # ensure Vision OCR returns None (configured-but-fails or not-configured paths)
    with patch("app.services.document_service._try_vision_ocr", return_value=None):
        parsed = parse_document(minimal_empty_pdf, "scan.pdf", "application/pdf")

    assert parsed.parse_method == "pdf-empty"
    assert any(w["code"] == "scanned_no_ocr" for w in parsed.warnings)
