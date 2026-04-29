# Document upload, summarize, translate

Spec for adding PDF/DOCX upload with LLM-powered summarization and translation,
delivered through the existing chat surface. Maximizes reuse of primitives
already in the codebase; isolates only what genuinely needs isolating.

- **Status**: design approved, awaiting written-spec review
- **Author**: Eric Gitangu
- **Date**: 2026-04-29
- **License**: MIT

---

## 1. Goals + non-goals

**Goals**

- Users upload `.pdf` or `.docx` (≤10 MB, ≤100 pages), then run **summarize** or
  **translate** against it.
- Summarize: same source language by default, or any of 12 curated targets +
  free-text fallback.
- Translate: any of the 12 curated targets + free-text fallback.
- Streamed markdown output, identical SSE feel to the chat path.
- Inline artifact card appears in the same chat thread; lives in unified
  history alongside chat messages.
- Output downloadable as `.md`, `.txt`, `.docx`, `.pdf` (client-side
  generation, lazy-loaded).
- Cache-first: identical uploads de-duped; identical (action, target_lang)
  outputs returned without re-calling the LLM.
- Every user action emits a generic toast + matching haptic.

**Non-goals**

- Layout-preserving translation (re-flowing into the original `.pdf` /
  `.docx` styling). Output is markdown-derived.
- Live collaborative editing of the result.
- Server-side rendering of `.pdf` / `.docx` outputs (client-side only).
- OCR for languages outside Vision API's coverage.
- Encrypted-PDF support beyond what `pypdf` decodes natively.

## 2. Architecture

```
Browser
  ├─ <DocumentUploadDialog>      shadcn Dialog → Sheet on <sm
  ├─ <ArtifactCard>              user-side bubble in chat thread
  ├─ <ArtifactOutputBubble>      assistant-side, ReactMarkdown stream
  ├─ <DownloadMenu>              md/txt/docx/pdf, lazy renderers
  └─ lib/api.ts
      ├─ uploadDocument(file)               POST /documents/upload (multipart)
      └─ streamDocumentProcess(id, opts)    GET  /documents/{id}/process (SSE)

FastAPI
  ├─ routers/documents.py                   upload + process
  ├─ services/document_service.py           parse, prompt, stream-with-cache
  ├─ services/document_processing.py        rust-or-py fallback wrapper
  └─ core/events.py                         registry + emit_event helper

Postgres                              Redis (read-through)
├─ artifacts                          ├─ artifact:{sha256}:parsed         24h
├─ artifact_outputs                   └─ artifact:{id}:out:{action}:{lang} 7d
└─ conversations  (+kind, +artifact_id)
```

DRY reuses (no rewrites): `get_llm_client().stream`, `sanitize_input`,
`validate_markdown`, `estimate_tokens`, `truncate_response`,
`_require_auth`, `_history_key`, `@log_latency`, `history_store.add`,
SSE-line parser in `lib/api.ts`, `MessageBubble`, Pawa palette + animations.

## 3. Data model

### 3.1 New tables

```sql
CREATE TABLE artifacts (
  id              UUID PRIMARY KEY,
  sha256          CHAR(64) NOT NULL,
  owner_email     TEXT NOT NULL,
  filename        TEXT NOT NULL,
  mime            TEXT NOT NULL,
  byte_size       INTEGER NOT NULL,
  page_count      INTEGER NOT NULL,
  char_count      INTEGER NOT NULL,
  source_lang     TEXT,
  parsed_text     TEXT NOT NULL,
  parse_method    TEXT NOT NULL,        -- 'docx' | 'pdf-text' | 'pdf-ocr' | 'pdf-empty'
  warnings        JSONB DEFAULT '[]',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX idx_artifacts_owner_sha ON artifacts(owner_email, sha256);

CREATE TABLE artifact_outputs (
  id              UUID PRIMARY KEY,
  artifact_id     UUID NOT NULL REFERENCES artifacts(id) ON DELETE CASCADE,
  action          TEXT NOT NULL,        -- 'summarize' | 'translate'
  target_lang     TEXT NOT NULL,
  content         TEXT NOT NULL,
  model           TEXT NOT NULL,
  tokens_used     INTEGER,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX idx_outputs_artifact_action_lang
  ON artifact_outputs(artifact_id, action, target_lang);
```

### 3.2 Conversations table — additive

```sql
ALTER TABLE conversations
  ADD COLUMN kind         TEXT NOT NULL DEFAULT 'chat',
  ADD COLUMN artifact_id  UUID REFERENCES artifacts(id) ON DELETE SET NULL;
```

`kind='document'` rows store: `query` = synthetic label
(e.g. `"Summarize · contract.pdf · → sw"`), `response` = cached LLM output,
`artifact_id` = FK. Existing `/api/v1/chat/history` returns the unified
timeline; no second history endpoint.

### 3.3 Pydantic schemas (BFF contract)

```python
class ArtifactWarning(BaseModel):
    code: Literal["scanned_no_ocr","truncated","large_file"]
    message: str

class ArtifactSummary(BaseModel):
    id: UUID
    filename: str
    mime: str
    byte_size: int
    page_count: int
    char_count: int
    source_lang: str | None
    parsed_preview: str           # first ~800 chars, sanitized
    parse_method: Literal["docx","pdf-text","pdf-ocr","pdf-empty"]
    warnings: list[ArtifactWarning]
    created_at: datetime

class HistoryItem(BaseModel):     # extended; existing fields preserved
    id: UUID
    kind: Literal["chat","document"] = "chat"
    query: str
    response: str
    model: str
    tokens_used: int | None = None
    created_at: datetime
    artifact: ArtifactSummary | None = None
```

TypeScript mirrors these by hand in `lib/api.ts` — single source of truth
maintained by reviewing the Python schemas, same as the existing pattern.

## 4. Parsing pipeline

### 4.1 New backend deps

```
python-multipart==0.0.20
python-docx==1.2.0
pypdf==5.7.0
google-cloud-vision==3.10.2     # lazy-imported only when scan detected
```

No Tesseract, no WeasyPrint, no reportlab — image stays trim.

### 4.2 Flow

```
upload (multipart)
  → validate(mime ∈ {pdf,docx}, byte_size ≤ 10MB)
  → sha256(bytes) ──→ artifacts(owner_email, sha256) hit?
                      ├─ yes → return cached ArtifactSummary
                      └─ no  ↓
  → dispatch:
      docx → python-docx → join paragraphs + tables → text
      pdf  → pypdf       → page-by-page text concat
              → if char_count / page_count < 40:
                   try google-cloud-vision (lazy)
                     ├─ ok    → ocr_text, parse_method='pdf-ocr'
                     └─ fail  → '', warning='scanned_no_ocr',
                                   parse_method='pdf-empty'
                 else: parse_method='pdf-text'
  → sanitize_input + normalize_document_text     (Rust + Py fallback)
  → detect_script(first 4kB)                     (Rust + Py fallback)
  → write artifacts row + Redis cache
  → return ArtifactSummary
```

### 4.3 Generic error toasts

| Internal | User-facing toast |
|---|---|
| Unsupported mime | `"Only .pdf and .docx files are supported."` |
| File > 10 MB | `"That file is over the 10 MB limit."` |
| pypdf throws | `"Couldn't read this PDF. Try re-saving it from the source."` |
| Vision API failure | `"OCR is unavailable right now — text-based PDFs still work."` |
| Empty after parse | `"This document appears to have no extractable text."` |

Server logs the exception; client only sees these strings.

## 5. Rust + PyO3 extensions

New `rust-core/src/document.rs`, registered in `lib.rs`, exposed via
`pawacloud_core`. Each function has a `_py_*` fallback in
`app/services/document_processing.py` following the existing `text_processing.py`
pattern.

| Function | Signature | Why Rust |
|---|---|---|
| `sha256_hex` | `(&[u8]) -> String` | Per-upload de-dup. `sha2` is materially faster than `hashlib` on multi-MB blobs; bytes never re-cross FFI. |
| `detect_script` | `(&str, usize) -> String` | Unicode-block scan over a 4 KB sample → BCP-47 tag (`en`/`ar`/`zh`/`ru`/`hi`/`am`/`und`). Cheap byte-iter. Deterministic doctest. |
| `normalize_document_text` | `(&str) -> String` | Document-aware normalization (preserves paragraph breaks, collapses runs of spaces inside paragraphs, dedupes consecutive blanks, normalizes line endings). Distinct from `sanitize_input` which collapses all whitespace. |
| `chunk_markdown` | `(&str, usize) -> Vec<String>` | Token-budgeted chunker for map-reduce on >120k-token docs. Heading-first then paragraph splits, never mid-sentence. |

Brings `/health/metrics` Rust-vs-Python comparison count from 7 → 11. Each
function: Rust unit test + Python doctest in the wrapper.

## 6. LLM orchestration

### 6.1 Prompts

```python
SUMMARIZE_SYSTEM = """You are a precise document summarizer. Output is markdown only.
Structure: ## Overview, ## Key Points (bullets), ## Action Items (numbered, if any).
Preserve named entities, dates, monetary figures verbatim. Do not invent content.
If the document is short, the Overview alone may suffice — omit empty sections."""

TRANSLATE_SYSTEM = """You are a professional translator. Translate the document below
into {target_language}. Preserve all markdown structure, headings, lists, tables,
inline emphasis, and code blocks. Keep proper nouns, brand names, file paths, and
URLs unchanged. Do not summarize, paraphrase, or omit content."""
```

Source-language hint from `detect_script` is passed as context, not as a
constraint. Target language is a BCP-47 tag for curated picks; free-text
"Other" is passed verbatim and trusted to the LLM.

### 6.2 Map-reduce path

```
estimate_tokens(parsed_text) ≤ 120_000
  ├─ yes → single-pass: stream Gemini directly
  └─ no  → chunk_markdown(parsed_text, 80_000)
           ├─ map:    summarize each chunk (bounded asyncio.gather, max 4 in flight)
           └─ reduce: feed concatenated chunk-summaries through SUMMARIZE_SYSTEM,
                     stream phase-2 output to client; emit progress events
```

Translation in map-reduce uses sliding windows with 200-token paragraph
overlap so context isn't lost across chunk boundaries.

### 6.3 SSE protocol

```
GET /api/v1/documents/{id}/process?action=summarize&lang=sw
Accept: text/event-stream

data: {"type":"parsed","tokens":4821,"chunks":1}
data: {"type":"cache_hit","content":"…full cached markdown…"}
data: {"type":"chunk","text":"## Overview\n"}
data: {"type":"chunk","text":"The contract establishes…"}
data: {"type":"progress","phase":"reduce","step":2,"of":4}
data: {"type":"done","tokens_used":3420,"model":"gemini-2.5-flash"}
data: {"type":"error","code":"llm_quota","message":"Try again in a minute."}
```

Cache flow: Redis check → PG check → if either hit, emit single
`cache_hit` + `done`. Cache miss: stream LLM, accumulate, write to PG +
Redis on `[DONE]`, then write `kind='document'` row to `conversations`.

`AbortController` on the wire; server polls `request.is_disconnected()`
between chunks for clean cancellation.

## 7. Event registry

Single source of truth: `app/core/events.py`.

```python
class EventCode(StrEnum):
    PARSED      = "parsed"
    CACHE_HIT   = "cache_hit"
    CHUNK       = "chunk"
    PROGRESS    = "progress"
    DONE        = "done"
    ERROR       = "error"

EVENT_REGISTRY: dict[EventCode, str] = {
    EventCode.PARSED:    "Document parsed; emits token + chunk count",
    EventCode.CACHE_HIT: "Cached output returned; no LLM call made",
    EventCode.CHUNK:     "Streamed markdown fragment from the LLM",
    EventCode.PROGRESS:  "Map-reduce phase update (>120k token docs)",
    EventCode.DONE:      "Stream complete; emits final token count",
    EventCode.ERROR:     "Generic error envelope; details in server logs",
}
```

`emit_event(request, code, **fields)` increments an in-memory counter and
emits a structured log line picked up automatically by Cloud Logging on
Cloud Run. Refuses to emit unregistered codes.

`/health/metrics` extends with `events.registered` + `events.counts_since_start`.
New `GET /health/events` returns plain registry for introspection.

Optional Terraform: one `google_logging_metric` for `event_code="error"`
behind `var.enable_log_metrics` flag (default off). No alert policy yet.

Frontend mirror in `lib/events.ts` with a dev-only assertion that fetches
`/health/events` and warns in console on schema drift.

## 8. UI surface

### 8.1 shadcn primitives (added via `pnpm dlx shadcn@latest add`)

```
dialog, dropdown-menu, button, sheet, tabs, progress,
badge, input, label, separator, sonner
```

These ship into `frontend/components/ui/*` and are not hand-edited.

### 8.2 Custom components

```
DocumentUploadDialog.tsx     drag-drop zone, action picker, language picker
ArtifactCard.tsx             user bubble — filename, size, action, lang chips
ArtifactOutputBubble.tsx     assistant bubble — markdown stream + DownloadMenu
DownloadMenu.tsx             4 download formats, lazy-loaded renderers
LanguagePicker.tsx           12 chips + "Other…" sheet
lib/haptics.ts               navigator.vibrate wrappers
lib/toast.ts                 sonner wrapper, paired with haptics
lib/render/docx.ts           lazy: marked → docx → Blob
lib/render/pdf.ts            lazy: marked → jspdf + html2canvas → Blob
```

### 8.3 MessageBubble extension

Discriminated `Message` union switches on `kind`. Chat path unchanged;
document path delegates to `ArtifactCard` (user) or `ArtifactOutputBubble`
(assistant). `prose-chat` markdown styles reused.

### 8.4 ChatInput

Paperclip button to the left of the textarea opens the upload dialog. Icon
glyph is 16 px; the button hit area is `min-h-[44px] min-w-[44px]` so the
thumb target meets WCAG / iOS guidance on touch. Dialog becomes a bottom
`Sheet` at `<sm`.

### 8.5 Snackbar → sonner

`Snackbar.tsx` is deleted in the same commit that introduces sonner.
Visual language preserved via `Toaster` config in `app/layout.tsx`. All
existing call sites in `app/page.tsx` migrate to `lib/toast.ts`.

### 8.6 Haptics

```typescript
export const haptics = {
  tap:     () => navigator.vibrate?.(8),
  success: () => navigator.vibrate?.([12, 40, 18]),
  warn:    () => navigator.vibrate?.([20, 60, 20, 60]),
  error:   () => navigator.vibrate?.([40, 80, 40]),
};
```

Wired into: file selection, upload-complete, action submit, stream done,
generic error, unsupported file, download click, copy.

### 8.7 Toast taxonomy

| Trigger | Kind | Message |
|---|---|---|
| File rejected (type/size) | warn | `"Only .pdf and .docx up to 10 MB."` |
| Upload success | success | `"Document ready."` |
| Upload network failure | error | `"Couldn't upload. Check your connection."` |
| Cache hit | info | `"Loaded from cache."` |
| Stream done | success | `"Translation ready."` / `"Summary ready."` |
| Stream error | error | `"Something went wrong. Try again."` |
| Download | success | `"Downloaded."` |
| Copy output | success | `"Copied."` |
| Delete history item | success | `"Removed."` |

Generic strings only — backend errors never reach the user verbatim.

## 9. Testing

### 9.1 Backend pytest

```
tests/test_documents_api.py
  test_upload_unauthenticated_rejected
  test_upload_unsupported_mime_rejected
  test_upload_oversize_rejected
  test_upload_returns_summary_for_docx_fixture
  test_upload_returns_summary_for_pdf_fixture
  test_upload_dedupes_same_sha_for_owner
  test_scanned_pdf_warns_when_vision_unavailable
  test_process_unknown_artifact_returns_404
  test_process_emits_cache_hit_when_output_exists
  test_process_emits_done_when_llm_succeeds
  test_process_emits_error_event_on_llm_failure
  test_event_registry_endpoint_lists_all_codes
```

Fixtures: `tests/fixtures/sample.docx`, `tests/fixtures/sample.pdf` —
generated once via `scripts/make-fixtures.py`, committed as binaries.
`get_llm_client` monkeypatched per-test; no live LLM calls.

### 9.2 Rust unit + Python doctest

```
rust-core/src/document.rs       cargo test --lib
app/services/document_processing.py    pytest --doctest-modules
```

### 9.3 Frontend

No automated frontend test framework exists in the repo and we don't add
one for this scope. Manual QA checklist lives in `docs/QA-DOCUMENTS.md`
covering golden path, edge cases (unsupported file, scanned PDF, large
file, mid-stream abort, cache hit), mobile viewports.

## 10. Commit cadence

Hard rules:

1. Each commit passes lint + typecheck. Backend `ruff check && ruff format --check`.
   Frontend `pnpm tsc --noEmit && pnpm eslint .`. Rust `cargo fmt --check && cargo clippy -- -D warnings`.
   Husky pre-commit enforces; we don't bypass.
2. Conventional Commits prefixes (`feat:`, `fix:`, `chore:`, `docs:`, `test:`)
   — required by commitlint. Body lower-case, terse, no period, no
   adjectives like "elegant" / "robust" / "production-grade".
3. No `Co-Authored-By` lines, no AI attribution anywhere.
4. Spaced over real time — task-by-task, not 20 commits in 90 seconds.
5. Permissible mistakes welcome — fix commits explain the why.

Planned sequence (1–24, may collapse where changes are small):

```
 1. add SPDX MIT license + author
 2. shadcn init + sonner toaster wired into layout
 3. lib/haptics + lib/toast wrappers; replace Snackbar call sites
 4. backend: pydantic schemas for artifacts + extended HistoryItem
 5. backend: pg migration adds artifacts, artifact_outputs,
       conversations.kind/artifact_id
 6. rust-core: document.rs with sha256_hex, detect_script,
       normalize_document_text, chunk_markdown + cargo tests
 7. backend: document_processing.py with rust-or-python fallback wrapper
 8. backend: document_service parse pipeline (docx + pdf, no OCR yet)
 9. backend: vision OCR fallback (lazy import, detect-and-warn)
10. backend: event registry + emit_event helper + /health/events endpoint
11. backend: documents router — upload (multipart) returns ArtifactSummary
12. backend: documents router — process SSE with cache read-through
13. backend: pytest suite for documents api
14. frontend: lib/api streamDocumentProcess + uploadDocument; events.ts mirror
15. frontend: shadcn add (dialog, tabs, dropdown, button, sheet, etc.)
16. frontend: DocumentUploadDialog + LanguagePicker
17. frontend: ArtifactCard + ArtifactOutputBubble; MessageBubble switch on kind
18. frontend: paperclip in ChatInput; wire upload → process → bubbles
19. frontend: DownloadMenu with lazy md/txt/docx/pdf renderers
20. frontend: history panel paperclip badge for kind='document'
21. infra (optional): log-based metric for error events behind feature flag
22. docs: ARCHITECTURE.md update + new docs/DOCUMENTS.md walkthrough
23. docs: PROMPTS.md addendum for summarize/translate prompts
24. docs: QA-DOCUMENTS.md manual checklist
```

## 11. Documentation

- `docs/ARCHITECTURE.md` — extend with "Document pipeline" section + Mermaid
  sequence diagram.
- `docs/DOCUMENTS.md` *(new)* — task-level walkthrough, schemas, event
  registry, prompts, OCR fallback behaviour, cache invalidation rules.
- `docs/PROMPTS.md` — addendum for summarize + translate prompts.
- `docs/QA-DOCUMENTS.md` *(new)* — manual QA checklist.
- README compliance table gains a single line linking to `docs/DOCUMENTS.md`.

## 12. License + IP

- `LICENSE` (new) — MIT, copyright `Eric Gitangu`, year `2026`.
- SPDX header on **new** source files only:
  - TS / Rust: `// SPDX-License-Identifier: MIT`
  - Python: `# SPDX-License-Identifier: MIT`
- No retroactive stamping of existing files.
- No mention of any AI tooling in code, commits, or docs.
- `docs/DOCUMENTS.md` footer: `© 2026 Eric Gitangu — MIT licensed.`
