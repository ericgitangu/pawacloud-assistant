# SPDX-License-Identifier: MIT
"""Behaviour tests for /api/v1/documents."""

from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.main import app


FIXTURES = Path(__file__).parent / "fixtures"


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def authed_client():
    c = TestClient(app)
    c.post("/auth/guest-pass", json={"email": "tester@pawait.co.ke"})
    return c


class TestDocumentUpload:
    def test_unauthenticated_rejected(self, client):
        with open(FIXTURES / "sample.pdf", "rb") as fh:
            resp = client.post(
                "/api/v1/documents/upload",
                files={"file": ("sample.pdf", fh, "application/pdf")},
            )
        assert resp.status_code == 401

    def test_unsupported_mime_rejected(self, authed_client):
        resp = authed_client.post(
            "/api/v1/documents/upload",
            files={"file": ("notes.txt", b"hello", "text/plain")},
        )
        assert resp.status_code == 415

    def test_oversize_rejected(self, authed_client):
        big = b"x" * (10 * 1024 * 1024 + 1)
        resp = authed_client.post(
            "/api/v1/documents/upload",
            files={"file": ("huge.pdf", big, "application/pdf")},
        )
        assert resp.status_code == 413

    def test_docx_returns_summary(self, authed_client):
        with open(FIXTURES / "sample.docx", "rb") as fh:
            resp = authed_client.post(
                "/api/v1/documents/upload",
                files={
                    "file": (
                        "sample.docx",
                        fh,
                        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                    )
                },
            )
        assert resp.status_code == 200
        data = resp.json()
        assert data["filename"] == "sample.docx"
        assert data["parse_method"] == "docx"
        assert data["char_count"] > 0
        assert "id" in data
        assert "parsed_preview" in data

    def test_pdf_returns_summary(self, authed_client):
        with open(FIXTURES / "sample.pdf", "rb") as fh:
            resp = authed_client.post(
                "/api/v1/documents/upload",
                files={"file": ("sample.pdf", fh, "application/pdf")},
            )
        assert resp.status_code == 200
        data = resp.json()
        assert data["parse_method"] == "pdf-text"

    def test_dedupes_same_sha_for_same_owner(self, authed_client, monkeypatch):
        from datetime import UTC, datetime
        from uuid import UUID

        from app.models.schemas import ArtifactSummary
        from app.routers import documents as docs_router

        cached_id = UUID("11111111-1111-1111-1111-111111111111")
        cached = ArtifactSummary(
            id=cached_id,
            filename="sample.pdf",
            mime="application/pdf",
            byte_size=10,
            page_count=1,
            char_count=20,
            source_lang="en",
            parsed_preview="cached preview",
            parse_method="pdf-text",
            warnings=[],
            created_at=datetime.now(UTC),
        )

        async def _hit(owner, sha):
            return cached

        monkeypatch.setattr(docs_router, "_find_existing", _hit)

        with open(FIXTURES / "sample.pdf", "rb") as fh:
            resp = authed_client.post(
                "/api/v1/documents/upload",
                files={"file": ("sample.pdf", fh, "application/pdf")},
            )

        assert resp.status_code == 200
        assert resp.json()["id"] == str(cached_id)
        assert resp.json()["parsed_preview"] == "cached preview"


class TestDocumentProcess:
    def test_unknown_artifact_returns_404(self, authed_client):
        resp = authed_client.get(
            "/api/v1/documents/00000000-0000-0000-0000-000000000000/process",
            params={"action": "summarize", "lang": "en"},
        )
        assert resp.status_code == 404

    def test_invalid_action_rejected(self, authed_client):
        resp = authed_client.get(
            "/api/v1/documents/00000000-0000-0000-0000-000000000000/process",
            params={"action": "translate-and-summarize", "lang": "en"},
        )
        assert resp.status_code == 422

    def test_unauthenticated_rejected(self, client):
        resp = client.get(
            "/api/v1/documents/00000000-0000-0000-0000-000000000000/process",
            params={"action": "summarize", "lang": "en"},
        )
        assert resp.status_code == 401


class TestDocumentProcessCacheHit:
    def test_cache_hit_emits_cache_hit_event(self, authed_client, monkeypatch):
        from uuid import UUID

        from app.routers import documents as docs_router

        artifact_id = UUID("11111111-1111-1111-1111-111111111111")

        async def _load(aid, owner):
            return ("sample document text", "en", "sample.pdf")

        async def _cached(aid, action, lang):
            return "## Cached summary\n\nThis is cached."

        monkeypatch.setattr(docs_router, "_load_artifact_text", _load)
        monkeypatch.setattr(docs_router, "_output_cache_get", _cached)

        resp = authed_client.get(
            f"/api/v1/documents/{artifact_id}/process",
            params={"action": "summarize", "lang": "en"},
        )
        assert resp.status_code == 200
        body = resp.text
        assert '"type": "cache_hit"' in body
        assert '"type": "done"' in body
        assert "Cached summary" in body
        # cache hit means LLM never streams chunks
        assert '"type": "chunk"' not in body
