# Architecture

Three layers, loosely coupled:

1. **Backend** — FastAPI (Python 3.12), handles chat/streaming/history/auth
2. **Frontend** — Next.js 16 + TailwindCSS v4, SSE streaming, PWA
3. **Rust Core** — PyO3 bindings for text processing, falls back to Python if not compiled

## Request flow

```yaml
Browser → Next.js middleware (auth gate) → page.tsx
  ↓ SSE
FastAPI /chat/stream → sanitize (Rust/Python) → Gemini 2.5 Flash → stream chunks
  ↓
History stored in Redis (keyed by user email for persistence across sessions)
```

## Auth

Three paths, all end up with a Redis session + `pawacloud_auth` cookie:

- Google OAuth (redirect flow)
- Email/password (bcrypt, PostgreSQL)
- Guest pass (@pawait.co.ke domain, 60-min TTL)

Frontend middleware checks `pawacloud_auth` cookie. No cookie → `/login`.
Cross-origin cookies use `SameSite=None; Secure` between Cloud Run and Fly.io.

## Data stores

- **PostgreSQL** — user accounts (email, name, picture, password_hash, provider)
- **Redis** — sessions (JSON blob, TTL'd) + chat history (per-user lists, keyed by email)
- Falls back to in-memory if either is unavailable

## Deployment

- Backend: GCP Cloud Run (africa-south1) — multi-stage Docker builds Rust, installs Python deps
- Frontend: Fly.io (JNB) — standalone Next.js output
- Infra: Terraform configs in `infra/` (Cloud Run + Artifact Registry + IAM)

## Why Rust

PyO3 bridge for text ops on every request/response.
7 functions: sanitize, tokenize, validate markdown, extract code blocks, format sources, truncate, similarity.
Live benchmarks at `/health/metrics`. Optional — Python fallback works identically.
