"""Chat router — Q&A endpoints with SSE streaming."""

import json
import logging
from datetime import UTC, datetime
from uuid import uuid4

from fastapi import APIRouter, HTTPException, Query, Request
from fastapi.responses import StreamingResponse

from app.core.decorators import log_latency
from app.models.schemas import (
    ChatRequest,
    ChatResponse,
    ErrorResponse,
    HistoryItem,
    HistoryResponse,
)
from app.services.history_service import history_store
from app.services.llm_service import get_llm_client
from app.services.text_processing import (
    sanitize_input,
    estimate_tokens,
    validate_markdown,
)
from app.services.response_processing import truncate_response

logger = logging.getLogger(__name__)
router = APIRouter()


def _history_key(request: Request) -> str:
    """Use email for authenticated users so history survives re-login.
    Falls back to session_id for anonymous/guest sessions."""
    user = getattr(request.state, "user", None)
    if user and user.get("email"):
        return f"user:{user['email']}"
    return getattr(request.state, "session_id", "default")


def _require_auth(request: Request):
    """Reject unauthenticated requests to LLM endpoints — prevents token abuse."""
    user = getattr(request.state, "user", None)
    if not user or not user.get("authenticated"):
        raise HTTPException(status_code=401, detail="Sign in to use the assistant")


@router.post(
    "/chat",
    response_model=ChatResponse,
    responses={
        400: {"model": ErrorResponse, "description": "Invalid input"},
        500: {"model": ErrorResponse, "description": "LLM generation failure"},
    },
    summary="Submit a query to the AI assistant",
)
@log_latency
async def chat(request: Request, body: ChatRequest) -> ChatResponse:
    _require_auth(request)
    sanitized = sanitize_input(body.query)
    sid = _history_key(request)

    try:
        client = get_llm_client()
        text, model_name, token_count = await client.generate(sanitized)
    except RuntimeError as exc:
        logger.error("chat generation failed: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    if not validate_markdown(text):
        text = "Response contained potentially unsafe content and was filtered."

    text = truncate_response(text, 2048)

    msg_id = uuid4()
    now = datetime.now(UTC)

    await history_store.add(
        item=HistoryItem(
            id=msg_id,
            query=body.query,
            response=text,
            model=model_name,
            tokens_used=token_count or estimate_tokens(text),
            created_at=now,
        ),
        session_id=sid,
    )

    return ChatResponse(
        id=msg_id,
        query=body.query,
        response=text,
        model=model_name,
        tokens_used=token_count or estimate_tokens(text),
        created_at=now,
    )


@router.get(
    "/chat/stream",
    summary="Stream AI response via SSE",
    description="Accepts a query parameter and streams the response in real-time.",
)
async def chat_stream(
    request: Request,
    q: str = Query(
        ...,
        min_length=1,
        max_length=2000,
        description="The user's question",
        examples=["Explain Cloud Run autoscaling"],
    ),
):
    """SSE streaming endpoint for real-time responses."""
    _require_auth(request)
    sanitized = sanitize_input(q)
    sid = _history_key(request)

    async def event_generator():
        full_response: list[str] = []
        try:
            client = get_llm_client()
            async for chunk in client.stream(sanitized):
                full_response.append(chunk)
                # json-encode so newlines survive SSE transport
                yield f"data: {json.dumps(chunk)}\n\n"
        except RuntimeError as exc:
            yield "data: Streaming failed — check API quota at console.cloud.google.com\n\n"
            logger.error("streaming error: %s", exc)

        yield "data: [DONE]\n\n"

        joined = "".join(full_response)
        if joined and validate_markdown(joined):
            await history_store.add(
                item=HistoryItem(
                    id=uuid4(),
                    query=q,
                    response=joined,
                    model="gemini-2.5-flash (streamed)",
                    created_at=datetime.now(UTC),
                ),
                session_id=sid,
            )

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.get(
    "/chat/history",
    response_model=HistoryResponse,
    summary="Retrieve conversation history",
)
async def get_history(
    request: Request,
    limit: int = Query(default=20, ge=1, le=50),
    offset: int = Query(default=0, ge=0),
) -> HistoryResponse:
    _require_auth(request)
    sid = _history_key(request)
    items, total = await history_store.get_page(
        limit=limit, offset=offset, session_id=sid
    )
    return HistoryResponse(items=items, total=total)


@router.delete("/chat/history/{item_id}", summary="Delete a single history item")
async def delete_history_item(request: Request, item_id: str):
    _require_auth(request)
    sid = _history_key(request)
    removed = await history_store.remove(item_id=item_id, session_id=sid)
    if not removed:
        raise HTTPException(status_code=404, detail="History item not found")
    return {"message": "Item deleted", "id": item_id}


@router.delete("/chat/history", summary="Clear conversation history")
async def clear_history(request: Request):
    _require_auth(request)
    sid = _history_key(request)
    count = await history_store.clear(session_id=sid)
    return {"message": f"Cleared {count} history items.", "cleared": count}
