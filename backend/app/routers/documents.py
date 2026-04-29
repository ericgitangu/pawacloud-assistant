# SPDX-License-Identifier: MIT
"""Documents router — multipart upload + SSE process."""

import logging
from datetime import UTC, datetime
from typing import Literal
from uuid import UUID, uuid4

from fastapi import APIRouter, File, HTTPException, Query, Request, UploadFile
from fastapi.responses import StreamingResponse

from app.core.config import get_settings
from app.core.decorators import log_latency
from app.models.schemas import ArtifactSummary, ArtifactWarning
from app.services.document_processing import sha256_hex
from app.services.document_service import (
    DOCX_MIME,
    JPEG_MIME,
    PDF_MIME,
    PNG_MIME,
    parse_document,
)

logger = logging.getLogger(__name__)
router = APIRouter()

DOCUMENT_MIMES = {DOCX_MIME, PDF_MIME}
IMAGE_MIMES = {JPEG_MIME, PNG_MIME}
ALLOWED_MIMES = DOCUMENT_MIMES | IMAGE_MIMES
IMAGE_MAX_BYTES = 8 * 1024 * 1024  # 8 MB cap for camera images


def _require_auth(request: Request) -> dict:
    user = getattr(request.state, "user", None)
    if not user or not user.get("authenticated"):
        raise HTTPException(status_code=401, detail="Sign in to upload documents")
    return user


@router.post(
    "/documents/upload",
    response_model=ArtifactSummary,
    summary="Upload a document for summarize/translate",
    responses={
        401: {"description": "Authentication required"},
        413: {"description": "File exceeds size limit"},
        415: {"description": "Unsupported mime type"},
    },
)
@log_latency
async def upload_document(
    request: Request, file: UploadFile = File(...)
) -> ArtifactSummary:
    user = _require_auth(request)
    settings = get_settings()

    mime = file.content_type or ""
    if mime not in ALLOWED_MIMES:
        raise HTTPException(
            status_code=415, detail="Only PDF, DOCX, JPG, or PNG are supported"
        )

    raw = await file.read()
    is_image = mime in IMAGE_MIMES
    cap = IMAGE_MAX_BYTES if is_image else settings.DOCUMENT_MAX_BYTES
    if len(raw) > cap:
        cap_mb = cap // (1024 * 1024)
        raise HTTPException(status_code=413, detail=f"File over the {cap_mb} MB limit")

    sha = sha256_hex(raw)
    owner = user.get("email", "anonymous")

    existing = await _find_existing(owner, sha)
    if existing is not None:
        return existing

    parsed = parse_document(raw, file.filename or "upload", mime)

    if parsed.page_count > settings.DOCUMENT_MAX_PAGES:
        raise HTTPException(
            status_code=413,
            detail=f"Document exceeds {settings.DOCUMENT_MAX_PAGES} page limit",
        )

    artifact_id = uuid4()
    now = datetime.now(UTC)
    summary = ArtifactSummary(
        id=artifact_id,
        filename=file.filename or "upload",
        mime=mime,
        byte_size=len(raw),
        page_count=parsed.page_count,
        char_count=parsed.char_count,
        source_lang=parsed.source_lang,
        parsed_preview=parsed.text[:800],
        parse_method=parsed.parse_method,
        warnings=[ArtifactWarning(**w) for w in parsed.warnings],
        created_at=now,
    )

    await _persist_artifact(
        artifact_id=artifact_id,
        sha=sha,
        owner=owner,
        summary=summary,
        parsed_text=parsed.text,
    )
    return summary


async def _find_existing(owner: str, sha: str) -> ArtifactSummary | None:
    from app.core.database import get_pool

    pool = get_pool()
    if not pool:
        return None
    try:
        async with pool.acquire() as conn:
            row = await conn.fetchrow(
                """SELECT id, filename, mime, byte_size, page_count, char_count,
                          source_lang, parsed_text, parse_method, warnings, created_at
                   FROM artifacts WHERE owner_email = $1 AND sha256 = $2""",
                owner,
                sha,
            )
            if not row:
                return None
            warnings_raw = row["warnings"] or []
            if isinstance(warnings_raw, str):
                import json as _json

                warnings_raw = _json.loads(warnings_raw)
            return ArtifactSummary(
                id=row["id"],
                filename=row["filename"],
                mime=row["mime"],
                byte_size=row["byte_size"],
                page_count=row["page_count"],
                char_count=row["char_count"],
                source_lang=row["source_lang"],
                parsed_preview=row["parsed_text"][:800],
                parse_method=row["parse_method"],
                warnings=[ArtifactWarning(**w) for w in warnings_raw],
                created_at=row["created_at"],
            )
    except Exception as exc:
        logger.debug("artifact lookup failed: %s", exc)
        return None


async def _persist_artifact(
    *,
    artifact_id: UUID,
    sha: str,
    owner: str,
    summary: ArtifactSummary,
    parsed_text: str,
) -> None:
    from app.core.database import get_pool
    import json

    pool = get_pool()
    if not pool:
        return  # in-memory mode; tests still pass since _find_existing returned None
    try:
        async with pool.acquire() as conn:
            await conn.execute(
                """INSERT INTO artifacts (id, sha256, owner_email, filename, mime,
                                          byte_size, page_count, char_count,
                                          source_lang, parsed_text, parse_method, warnings)
                   VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb)""",
                artifact_id,
                sha,
                owner,
                summary.filename,
                summary.mime,
                summary.byte_size,
                summary.page_count,
                summary.char_count,
                summary.source_lang,
                parsed_text,
                summary.parse_method,
                json.dumps([w.model_dump() for w in summary.warnings]),
            )
    except Exception as exc:
        logger.warning("artifact persist failed: %s", exc)


@router.get(
    "/documents/{artifact_id}/process",
    summary="Stream summarize/translate output for an uploaded artifact",
)
async def process_document(
    request: Request,
    artifact_id: UUID,
    action: Literal["summarize", "translate"] = Query(...),
    lang: str = Query(..., min_length=2, max_length=64),
):
    user = _require_auth(request)

    artifact = await _load_artifact_text(artifact_id, user.get("email", "anonymous"))
    if artifact is None:
        raise HTTPException(status_code=404, detail="Artifact not found")

    parsed_text, source_lang, filename = artifact

    from app.services.document_service import stream_with_cache

    async def _gen():
        async for line in stream_with_cache(
            request=request,
            artifact_id=artifact_id,
            parsed_text=parsed_text,
            source_lang=source_lang,
            action=action,
            target_lang=lang,
            output_cache_get=_output_cache_get,
            output_cache_set=_output_cache_set,
            history_persist=_history_persist_factory(filename, request),
        ):
            if await request.is_disconnected():
                return
            yield line

    return StreamingResponse(
        _gen(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


async def _load_artifact_text(
    artifact_id: UUID, owner: str
) -> tuple[str, str | None, str] | None:
    from app.core.database import get_pool

    pool = get_pool()
    if not pool:
        return None
    try:
        async with pool.acquire() as conn:
            row = await conn.fetchrow(
                """SELECT parsed_text, source_lang, filename
                   FROM artifacts WHERE id = $1 AND owner_email = $2""",
                artifact_id,
                owner,
            )
            if not row:
                return None
            return row["parsed_text"], row["source_lang"], row["filename"]
    except Exception as exc:
        logger.warning("artifact load failed: %s", exc)
        return None


async def _output_cache_get(artifact_id: UUID, action: str, lang: str) -> str | None:
    from app.core.database import get_pool

    pool = get_pool()
    if not pool:
        return None
    try:
        async with pool.acquire() as conn:
            return await conn.fetchval(
                """SELECT content FROM artifact_outputs
                   WHERE artifact_id = $1 AND action = $2 AND target_lang = $3""",
                artifact_id,
                action,
                lang,
            )
    except Exception:
        return None


async def _output_cache_set(
    artifact_id: UUID,
    action: str,
    lang: str,
    content: str,
    model: str,
    tokens: int | None,
) -> None:
    from app.core.database import get_pool

    pool = get_pool()
    if not pool:
        return
    try:
        async with pool.acquire() as conn:
            await conn.execute(
                """INSERT INTO artifact_outputs (id, artifact_id, action, target_lang, content, model, tokens_used)
                   VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6)
                   ON CONFLICT (artifact_id, action, target_lang)
                   DO UPDATE SET content = EXCLUDED.content,
                                 model = EXCLUDED.model,
                                 tokens_used = EXCLUDED.tokens_used,
                                 created_at = now()""",
                artifact_id,
                action,
                lang,
                content,
                model,
                tokens,
            )
    except Exception as exc:
        logger.warning("output cache write failed: %s", exc)


def _history_persist_factory(filename: str, request: Request):
    """Closure that writes a 'document' history row when the stream finishes."""
    from app.routers.chat import _history_key

    sid = _history_key(request)

    async def _persist(
        artifact_id: UUID,
        action: str,
        lang: str,
        label: str,
        content: str,
        model: str,
        tokens: int | None,
    ) -> None:
        from app.core.database import get_pool

        pool = get_pool()
        if not pool:
            return
        try:
            async with pool.acquire() as conn:
                await conn.execute(
                    """INSERT INTO conversations
                       (id, session_id, query, response, model, tokens_used, kind, artifact_id)
                       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, 'document', $6)""",
                    sid,
                    f"{label} · {filename}",
                    content,
                    model,
                    tokens,
                    artifact_id,
                )
        except Exception as exc:
            logger.warning("history persist (document) failed: %s", exc)

    return _persist
