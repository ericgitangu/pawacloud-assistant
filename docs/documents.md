# Document pipeline

> Upload PDF/DOCX/JPG/PNG → summarize or translate → stream markdown back.
> Cache-first; outputs live in the unified chat history.

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/v1/documents/upload` | Multipart upload, returns `ArtifactSummary` |
| GET  | `/api/v1/documents/{id}/process?action&lang` | SSE stream of typed events |
| GET  | `/health/events` | Event registry introspection |
| GET  | `/health/metrics` | Includes Rust-vs-Python benchmarks + event counts |

## Limits

- 10 MB max for `.pdf` / `.docx`; 8 MB max for `.jpg` / `.png`
- 100 page max
- Files: `.pdf`, `.docx`, `.jpg`/`.jpeg`, `.png`

## Parse pipeline

```
upload → mime/size validation → sha256 → de-dup check
       → docx (python-docx) | pdf (pypdf) | image (Vision OCR direct)
       → if pdf text-layer empty: try Vision OCR (lazy)
       → sanitize_input → normalize_document_text (Rust+Py)
       → detect_script (Rust+Py) for source-language hint
       → write artifacts row → return ArtifactSummary
```

Vision OCR is gated by `GOOGLE_VISION_KEY_PATH`. Without it, scanned PDFs
return `parse_method='pdf-empty'` plus a `scanned_no_ocr` warning, and
images return `parse_method='image-empty'` plus the same warning.

## Event registry

| Code | When emitted | Payload |
|---|---|---|
| `parsed` | After parse, before LLM | `{ tokens, chunks }` |
| `cache_hit` | Output already cached for `(artifact, action, lang)` | `{ content }` |
| `chunk` | Streamed markdown fragment | `{ text }` |
| `progress` | Map-reduce phase update (>120k token docs) | `{ phase, step, of }` |
| `done` | Stream complete | `{ tokens_used, model }` |
| `error` | Generic envelope; details in server logs | `{ code, message }` |

## Cache layers

| Layer | Key | TTL |
|---|---|---|
| Postgres `artifacts` | `(owner_email, sha256)` unique | persistent |
| Postgres `artifact_outputs` | `(artifact_id, action, target_lang)` unique | persistent |
| Redis (read-through) | `artifact:{sha256}:parsed` | 24h (config: `DOCUMENT_CACHE_TTL_PARSED`) |
| Redis (read-through) | `artifact:{id}:out:{action}:{lang}` | 7d (config: `DOCUMENT_CACHE_TTL_OUTPUT`) |

## Rust extensions

`pawacloud_core::document` exposes:

- `sha256_hex(bytes)` — upload de-dup
- `detect_script(text, sample_chars)` — BCP-47 hint by Unicode block scan
- `normalize_document_text(raw)` — paragraph-preserving normalization
- `chunk_markdown(text, max_tokens)` — token-budgeted chunker

Each has a Python fallback in `app/services/document_processing.py`.
Benchmarked at `/health/metrics`.

## Camera capture + blur gate (frontend)

Mobile users can attach an image straight from the camera via
`<input type="file" accept="image/jpeg,image/png" capture="environment">`.
On selection, the image is loaded into an `Image` element, drawn on a
hidden `<canvas>`, and `getImageData` runs through a Laplacian-variance
estimator (`frontend/lib/blurDetect.ts`):

- variance ≥ 100 → "Looks clear ✓" (green pill, submit enabled)
- 60 ≤ variance < 100 → "A little soft — try again?" (yellow, submit allowed)
- variance < 60 → "Try a steadier shot" (red, submit disabled)

Detection runs on a 640 px-wide downscale of the source for sub-100 ms
performance even on mobile.

## History integration

When a stream finishes (cache hit or LLM completion), a row is inserted into
`conversations` with `kind='document'`, `artifact_id` FK, and `query` set
to a synthetic label (e.g. `"Translate → sw · contract.pdf"`). The frontend
`HistoryPanel` shows a paperclip glyph for these rows; the existing single
history endpoint serves the unified timeline.

© 2026 Eric Gitangu — MIT licensed.
