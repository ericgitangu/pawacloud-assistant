# SPDX-License-Identifier: MIT
"""Document parsing pipeline — docx + pdf text extraction with normalization."""

import io
import logging
from dataclasses import dataclass

from docx import Document
from pypdf import PdfReader

from app.services.document_processing import (
    detect_script,
    normalize_document_text,
)
from app.services.text_processing import sanitize_input

logger = logging.getLogger(__name__)

DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
PDF_MIME = "application/pdf"


@dataclass
class ParsedDocument:
    text: str
    page_count: int
    char_count: int
    source_lang: str | None
    parse_method: str
    warnings: list[dict]


def parse_document(raw: bytes, filename: str, mime: str) -> ParsedDocument:
    if mime == DOCX_MIME or filename.lower().endswith(".docx"):
        return _parse_docx(raw)
    if mime == PDF_MIME or filename.lower().endswith(".pdf"):
        return _parse_pdf(raw)
    raise ValueError(f"unsupported mime: {mime}")


def _parse_docx(raw: bytes) -> ParsedDocument:
    doc = Document(io.BytesIO(raw))
    parts: list[str] = []
    for p in doc.paragraphs:
        parts.append(p.text)
    for table in doc.tables:
        for row in table.rows:
            parts.append(" | ".join(cell.text for cell in row.cells))

    raw_text = "\n\n".join(p for p in parts if p)
    text = normalize_document_text(sanitize_input(raw_text))
    return ParsedDocument(
        text=text,
        page_count=max(1, _approx_page_count(text)),
        char_count=len(text),
        source_lang=detect_script(text, 4096),
        parse_method="docx",
        warnings=[],
    )


def _try_vision_ocr(raw_pdf: bytes) -> str | None:
    """Send the PDF to Google Cloud Vision for OCR.

    Returns the extracted text on success, None on any failure (missing
    credentials, quota exceeded, network error, malformed PDF). Errors
    are logged but never raised — caller falls back to detect-and-warn.
    """
    try:
        from app.core.config import get_settings

        settings = get_settings()
        if not settings.GOOGLE_VISION_KEY_PATH:
            return None

        # lazy import — only paid when we actually call this path
        from google.cloud import vision

        client = vision.ImageAnnotatorClient.from_service_account_json(
            settings.GOOGLE_VISION_KEY_PATH
        )
        request = vision.AnnotateFileRequest(
            input_config=vision.InputConfig(
                content=raw_pdf,
                mime_type="application/pdf",
            ),
            features=[
                vision.Feature(type_=vision.Feature.Type.DOCUMENT_TEXT_DETECTION)
            ],
        )
        resp = client.batch_annotate_files(requests=[request])
        if not resp.responses:
            return None
        pages_text: list[str] = []
        for file_resp in resp.responses:
            for page_resp in file_resp.responses:
                if page_resp.full_text_annotation:
                    pages_text.append(page_resp.full_text_annotation.text)
        return "\n\n".join(pages_text) if pages_text else None
    except Exception as exc:
        logger.warning("vision ocr failed: %s", exc)
        return None


def _parse_pdf(raw: bytes) -> ParsedDocument:
    reader = PdfReader(io.BytesIO(raw))
    parts: list[str] = []
    for page in reader.pages:
        parts.append(page.extract_text() or "")

    raw_text = "\n\n".join(p for p in parts if p.strip())
    text = normalize_document_text(sanitize_input(raw_text))
    page_count = len(reader.pages)

    parse_method = "pdf-text"
    warnings: list[dict] = []

    # OCR fallback only when the text layer is completely empty — a sparse-text
    # heuristic would mis-fire on small valid PDFs (test fixtures, short memos)
    if not text.strip():
        ocr_text = _try_vision_ocr(raw)
        if ocr_text:
            text = normalize_document_text(sanitize_input(ocr_text))
            parse_method = "pdf-ocr"
            page_count = max(page_count, 1)
        else:
            parse_method = "pdf-empty"
            warnings.append(
                {
                    "code": "scanned_no_ocr",
                    "message": "This PDF appears to be a scan — no extractable text layer.",
                }
            )

    return ParsedDocument(
        text=text,
        page_count=page_count,
        char_count=len(text),
        source_lang=detect_script(text, 4096) if text else None,
        parse_method=parse_method,
        warnings=warnings,
    )


def _approx_page_count(text: str) -> int:
    """DOCX has no native page count; ~3000 chars per page is a reasonable rough hint."""
    return max(1, len(text) // 3000)
