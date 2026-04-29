"""Request/response schemas — Pydantic v2 models with validators."""

from datetime import UTC, datetime
from typing import Literal
from uuid import UUID, uuid4

from pydantic import BaseModel, Field, field_validator


class ChatRequest(BaseModel):
    """Incoming user query."""

    query: str = Field(
        ...,
        min_length=1,
        max_length=2000,
        description="The user's question for the AI assistant.",
        examples=["What documents do I need to travel from Kenya to Ireland?"],
    )
    conversation_id: str | None = Field(
        default=None,
        description="Optional conversation ID for multi-turn context.",
    )

    @field_validator("query")
    @classmethod
    def query_not_blank(cls, v: str) -> str:
        stripped = v.strip()
        if not stripped:
            raise ValueError("Query must contain non-whitespace characters.")
        return stripped


class ChatResponse(BaseModel):
    """AI-generated response returned to the frontend."""

    id: UUID = Field(default_factory=uuid4)
    query: str
    response: str
    model: str
    tokens_used: int | None = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))


class ArtifactWarning(BaseModel):
    """Non-fatal parse condition surfaced to the client."""

    code: Literal["scanned_no_ocr", "truncated", "large_file", "ocr_no_text"]
    message: str


class ArtifactSummary(BaseModel):
    """Result of an upload — all the metadata the frontend renders in the artifact card."""

    id: UUID
    filename: str
    mime: str
    byte_size: int
    page_count: int
    char_count: int
    source_lang: str | None = None
    parsed_preview: str
    parse_method: Literal[
        "docx",
        "pdf-text",
        "pdf-ocr",
        "pdf-empty",
        "image-ocr",
        "image-empty",
    ]
    warnings: list[ArtifactWarning] = Field(default_factory=list)
    created_at: datetime


class HistoryItem(BaseModel):
    """Single conversation turn — chat or document."""

    id: UUID
    kind: Literal["chat", "document"] = "chat"
    query: str
    response: str
    model: str
    tokens_used: int | None = None
    created_at: datetime
    artifact: ArtifactSummary | None = None


class HistoryResponse(BaseModel):
    """Paginated conversation history."""

    items: list[HistoryItem]
    total: int


class ErrorResponse(BaseModel):
    """Standardized error payload."""

    detail: str
    code: str = "INTERNAL_ERROR"
