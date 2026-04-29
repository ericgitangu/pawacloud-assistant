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
