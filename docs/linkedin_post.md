# LinkedIn launch post — PawaCloud Assistant

> Daily ritual: ship something, write up what changed, then post.
> This file is the source of truth for the next post — copy/paste from here.

---

## v2 release — what shipped today

Spent the last week extending PawaCloud Assistant from a streamed Q&A bot
into a small document workbench. Same stack — same Africa-south1 Cloud Run
backend, same Next.js + Tailwind v4 frontend — but it now reads, summarizes,
and translates documents end-to-end.

Live: https://pawacloud-web.vercel.app
Code: https://github.com/ericgitangu/pawacloud-assistant

### v1 → v2

| Surface     | v1                                | v2                                                                                |
| ----------- | --------------------------------- | --------------------------------------------------------------------------------- |
| Chat        | Streamed Gemini answers           | Same — plus prompt suggestions in Swahili and English                             |
| Documents   | None                              | Upload PDF / DOCX / JPG / PNG (≤10 MB) — summarize OR translate via SSE           |
| OCR         | None                              | Camera capture on mobile + Laplacian-variance blur gate + Cloud Vision fallback   |
| Languages   | None                              | 12 curated languages with country flags, plus a free-text picker                  |
| Persistence | In-memory                         | PostgreSQL `artifacts` + `artifact_outputs` cache, served instantly on repeat ask |
| Export      | Copy/paste                        | Client-side md / txt / docx / pdf — rendered with `docx` and `jspdf`              |
| History     | Per-session                       | Unified across chat + document artifacts                                          |
| Auth        | Google OAuth                      | Same — plus email/password (Argon2id) and a real signup flow                      |
| Offline     | None                              | Installable PWA — cached artifacts viewable offline                               |

### Pieces that pulled their weight

- **Streaming is one protocol.** Both `/chat` and `/documents/process` emit the
  same typed JSON event envelope (`parsed`, `cache_hit`, `chunk`, `done`,
  `error`). One SSE consumer on the frontend handles both.
- **Rust + PyO3 is not decoration.** `pawacloud_core` does sha256 hashing,
  script detection, and markdown chunking. It's the same pattern I run in
  BSD Engine and Wave. Pure-Python fallback ships when the wheel isn't built.
- **Cache-first beats clever.** Hash the bytes, key by `(artifact, action,
  target_lang)`, return cached output before calling Gemini. Repeat asks
  feel free.
- **Vision OCR fails soft.** If credentials are missing or the API errors,
  we surface "scanned, no OCR" with a useful error — never a 500.

### What I changed my mind about

- **One PR per concern is the right granularity.** Tried to bundle the
  capability cards + the post-login welcome fix + the LinkedIn doc into one
  commit. Split it into three. Reviewers (and future-me) thanked me.
- **Browser-side PDF rendering > server-side.** Started with a server PDF
  endpoint. Killed it. `jspdf` + `docx` in the browser is faster, cheaper,
  and one fewer Cloud Run cold start.

### Stack

Python 3.12 · FastAPI · asyncpg · Redis · Pydantic v2 · Rust + PyO3 ·
Next.js 16 · Tailwind v4 · shadcn-ui · sonner · Gemini 2.5 Flash ·
Cloud Run (africa-south1) · Vercel · Cloud Vision · PostgreSQL (Neon).

### Day-1 numbers (from prod, snapshotted before the post)

> Pulled from the live Neon PG — no PII, just shape.

- **9 users signed up** between 12 Mar and 1 Apr — 8 distinct days
- **6 via Google OAuth** · 1 email/password · 1 linked both · 1 legacy guest-pass (since removed)
- **3 from `pawait.co.ke` / `dev.pawait.co.ke`** — the assessor's own domain showed up
- **5 artifacts uploaded** by 2 distinct users · 4 cached outputs (cache-first paid back)
- **7 chat sessions** + 1 document summarize/translate flow
- DB footprint: **8.7 MB** total · Rust hot paths benchmarked at **3-101× over Python**
  (`detect_script` is 101.8× — that's the one that matters for source-language hinting)

### Hashtags

```
#BuildingInPublic #DailyShip #SeniorEngineer #GCP #CloudRun #Gemini
#FastAPI #NextJS #TailwindCSS #Rust #PyO3 #Postgres #Redis #PWA
#Africa #Nairobi #Kenya #PawaIT #DocumentAI #OCR #Streaming #SSE
```

### The post (paste-ready)

> v2 of PawaCloud Assistant is live.
>
> v1 was a Gemini chat that streamed answers about cloud, code, and East
> African travel docs. v2 turns it into a small document workbench: upload
> a PDF, DOCX, JPG, or PNG (or snap one with your phone camera), then
> summarize or translate it into one of 12 curated languages — or any
> language you type. Cache-first, so repeat asks load instantly.
>
> Three pieces that earned their keep:
> - One SSE event protocol shared by `/chat` and `/documents/process`
> - A Rust+PyO3 hot path for hashing, script detection, and chunking
> - Camera capture with a Laplacian-variance blur gate before upload
>
> Day-1 numbers (no PII, just shape): 9 sign-ups across 8 distinct days, 6
> via Google OAuth, 5 artifacts uploaded, and the Rust+PyO3 `detect_script`
> hot path is running 101.8× over the Python fallback.
>
> Demo: https://pawacloud-web.vercel.app
> Source: https://github.com/ericgitangu/pawacloud-assistant
>
> #BuildingInPublic #DailyShip #GCP #Gemini #FastAPI #NextJS #Rust #PyO3
> #PWA #DocumentAI #OCR #Africa #Nairobi #PawaIT

---

## Notes for next post

- Keep the v1 → v2 table — it travels well and gets re-shared
- If the next ship is the dependabot major-bumps, post about lockfile hygiene
  and supply-chain scoring instead — that's a different audience
- TODO: short Loom for the camera OCR flow on mobile (better than a screenshot)
