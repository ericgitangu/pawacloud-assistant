"""Request/response schemas — Pydantic v2 models with validators."""

from datetime import UTC, datetime
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


class HistoryItem(BaseModel):
    """Single conversation turn."""

    id: UUID
    query: str
    response: str
    model: str
    tokens_used: int | None = None
    created_at: datetime


class HistoryResponse(BaseModel):
    """Paginated conversation history."""

    items: list[HistoryItem]
    total: int


class ErrorResponse(BaseModel):
    """Standardized error payload."""

    detail: str
    code: str = "INTERNAL_ERROR"
