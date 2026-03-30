# Evaluation Mapping

How the submission maps to the assessment criteria.

## Code Quality (40%)

| Aspect | Where to look |
| -------- | -------------- |
| Naming | `llm_output`, `sanitized_query`, `_history_key` — domain names, not tutorial names |
| Error handling | `ErrorResponse` schema, `@log_latency` decorator, actionable messages |
| Organization | `routers/` → `services/` → `models/` → `core/` on backend. `components/` → `lib/` → `app/` on frontend |
| API design | Versioned REST, typed Pydantic v2 models, OpenAPI auto-generated, SSE streaming |
| Testing | pytest covering health, auth, chat validation, history. Tests check behaviour, not mocks |

## Technical Implementation (30%)

| Aspect | Where to look |
| -------- | -------------- |
| Stack integration | FastAPI + Gemini + Next.js 16 + TailwindCSS v4 + Redis + OAuth + Rust PyO3 + Docker + Terraform |
| Performance | Rust PyO3 text processing, SSE streaming, abort controllers on polling. Live benchmarks at `/health/metrics` |
| Modern patterns | FastAPI lifespan, Pydantic v2, async generators, App Router, TailwindCSS v4 `@theme` |

## UI/UX Design (30%)

| Aspect | Where to look |
| -------- | -------------- |
| Responsive | Mobile hamburger, collapsible history, auto-resize textarea, 320px safeguards |
| Loading states | Typing dots → streaming cursor → copy button. Skeleton shimmer on status page |
| Accessibility | `aria-live` on streaming, `role="alert"` on errors, `role="dialog"` on history, keyboard shortcuts |

## Beyond Requirements

| Feature | Rationale |
| --------- | ----------- |
| Rust PyO3 | Optional native text processing with Python fallback. `sanitize_input`: ~0.9us vs ~45us (50x), `estimate_tokens`: ~1.2us vs ~120us (100x), `validate_markdown`: ~2.1us vs ~80us (38x). Live at [`/health/metrics`](https://pawacloud-api-904401126919.africa-south1.run.app/health/metrics) |
| Redis sessions | History persists across cold starts. Keyed by user email, not session ID |
| Google OAuth + Guest Pass | GCP alignment. `@pawait.co.ke` fast pass reduces grading friction |
| Status dashboard | `/status` with live benchmarks, latency charts, infra metadata |
| Terraform IaC | Reproducible Cloud Run provisioning in `infra/` |
| Multilingual | Gemini handles Swahili, Amharic, French natively — no extra service |

## Given More Time

- ELK stack for structured log aggregation
- OpenTelemetry traces across FastAPI → Gemini → Redis
- (APM) - Prometheus + Grafana for latency percentiles and error rates
- GitHub Actions CI/CD with preview deployments per PR - CI done, CD not done
- Multi-turn conversation context (schema already supports `conversation_id`)
- RAG pipeline with Vertex AI embeddings + AlloyDB pgvector
