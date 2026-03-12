"""Backend tests — validates API behaviour, not implementation."""

import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def authed_client():
    """Client with an active guest-pass session — for endpoints that need auth."""
    c = TestClient(app)
    c.post("/auth/guest-pass", json={"email": "tester@pawait.co.ke"})
    return c


class TestHealthEndpoint:
    def test_health_returns_200(self, client):
        resp = client.get("/health")
        assert resp.status_code == 200

    def test_health_contains_status(self, client):
        data = client.get("/health").json()
        assert data["status"] == "healthy"
        assert "version" in data
        assert "llm_provider" in data

    def test_health_reports_gemini(self, client):
        data = client.get("/health").json()
        assert data["llm_provider"] == "Google Gemini"

    def test_health_reports_rust_flag(self, client):
        data = client.get("/health").json()
        assert "rust_native" in data
        assert isinstance(data["rust_native"], bool)


class TestInfraEndpoint:
    def test_infra_returns_200(self, client):
        resp = client.get("/health/infra")
        assert resp.status_code == 200

    def test_infra_local_environment(self, client):
        data = client.get("/health/infra").json()
        assert data["environment"] in ("local", "fly_io", "cloud_run")
        assert "fly_io" in data
        assert "cloud_run" in data

    def test_infra_has_service_fields(self, client):
        data = client.get("/health/infra").json()
        assert "app" in data["fly_io"]
        assert "region" in data["fly_io"]
        assert "service" in data["cloud_run"]


class TestLLMHealth:
    def test_llm_health_returns_200(self, client):
        resp = client.get("/health/llm")
        assert resp.status_code == 200

    def test_llm_health_has_status(self, client):
        data = client.get("/health/llm").json()
        assert "status" in data
        assert data["status"] in ("operational", "degraded")


class TestRootEndpoint:
    def test_root_returns_service_info(self, client):
        resp = client.get("/")
        assert resp.status_code == 200
        data = resp.json()
        assert "service" in data
        assert "docs" in data


class TestChatEndpoint:
    """Validation tests — these don't need a live LLM."""

    def test_unauthenticated_rejected(self, client):
        resp = client.post("/api/v1/chat", json={"query": "hello"})
        assert resp.status_code == 401

    def test_empty_query_rejected(self, authed_client):
        resp = authed_client.post("/api/v1/chat", json={"query": ""})
        assert resp.status_code == 422

    def test_whitespace_query_rejected(self, authed_client):
        resp = authed_client.post("/api/v1/chat", json={"query": "   "})
        assert resp.status_code == 422

    def test_missing_query_rejected(self, authed_client):
        resp = authed_client.post("/api/v1/chat", json={})
        assert resp.status_code == 422

    def test_query_too_long_rejected(self, authed_client):
        long_query = "a" * 2001
        resp = authed_client.post("/api/v1/chat", json={"query": long_query})
        assert resp.status_code == 422


class TestHistoryEndpoint:
    def test_history_unauthenticated_rejected(self, client):
        resp = client.get("/api/v1/chat/history")
        assert resp.status_code == 401

    def test_history_returns_empty_initially(self, authed_client):
        authed_client.delete("/api/v1/chat/history")
        resp = authed_client.get("/api/v1/chat/history")
        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] == 0
        assert data["items"] == []

    def test_clear_history(self, authed_client):
        resp = authed_client.delete("/api/v1/chat/history")
        assert resp.status_code == 200
        assert "cleared" in resp.json()

    def test_history_pagination_params(self, authed_client):
        resp = authed_client.get("/api/v1/chat/history?limit=5&offset=0")
        assert resp.status_code == 200


class TestAuthEndpoint:
    def test_me_unauthenticated(self, client):
        resp = client.get("/auth/me")
        assert resp.status_code == 200
        data = resp.json()
        assert data["authenticated"] is False

    def test_login_without_credentials(self, client):
        """Without GOOGLE_CLIENT_ID configured, login returns error message."""
        resp = client.get("/auth/login", follow_redirects=False)
        # either redirects (configured) or returns error JSON (not configured)
        assert resp.status_code in (200, 307)

    def test_logout(self, client):
        resp = client.post("/auth/logout")
        assert resp.status_code == 200

    def test_signup_creates_account(self, client):
        resp = client.post(
            "/auth/signup",
            json={
                "email": "test@example.com",
                "name": "Test User",
                "password": "testpass123",
            },
        )
        # 201 if postgres available, may still work without (graceful fallback)
        assert resp.status_code in (201, 200)
        data = resp.json()
        assert "user" in data

    def test_signup_short_password_rejected(self, client):
        resp = client.post(
            "/auth/signup",
            json={"email": "x@x.com", "name": "X", "password": "short"},
        )
        assert resp.status_code == 422

    def test_login_invalid_credentials(self, client):
        resp = client.post(
            "/auth/login",
            json={"email": "nobody@example.com", "password": "wrong"},
        )
        # 401 if postgres is available, 503 if not
        assert resp.status_code in (401, 503)

    def test_guest_pass_pawait_domain(self, client):
        resp = client.post(
            "/auth/guest-pass",
            json={"email": "reviewer@pawait.co.ke"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["ttl_minutes"] == 60

    def test_guest_pass_rejected_for_other_domains(self, client):
        resp = client.post(
            "/auth/guest-pass",
            json={"email": "someone@gmail.com"},
        )
        assert resp.status_code == 403
