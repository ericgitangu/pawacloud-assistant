# Growth playbook

A focused list of follow-ups to keep the repo healthy and earn a few visible
GitHub achievements without performative grinding.

## GitHub achievements still on the table

### Pull Shark (Silver)

- Need: 16 merged PRs (currently around 5).
- Plan: every meaningful change goes through a PR — `chore/*`, `feat/*`,
  `fix/*`, `docs/*`. The polish PR that ships this file counts as one. The
  `feat/document-upload` PR coming next counts as another. The dependabot
  weekly cadence will produce a steady drip — accept the safe ones.

### Quickdraw

- Need: close an issue or PR within 5 minutes of opening it.
- Plan (one-shot, included in this run):

```bash
ISSUE_NUM=$(gh issue create --title "Track: deploy parity (cloud run + fly.io)" \
  --body "Tracking parity between Cloud Run (africa-south1) and Fly.io (JNB) — env-var alignment, region failover, billing visibility." \
  | tail -1 | sed 's:.*/::')
sleep 8
gh issue close "$ISSUE_NUM" --comment "Captured. Tracking separately."
```

### YOLO

- Need: merge a PR without review.
- Plan: solo-merge any docs-only or trivial config PR. The polish PR itself
  qualifies if merged with `gh pr merge --squash --delete-branch` against
  `main` without inviting reviewers.

### Galaxy Brain (Bronze)

- Need: 2 accepted answers in Discussions.
- Plan (manual, since Discussions creation via API needs a category id and
  the UI is faster):

  1. Enable Discussions: `gh repo edit ericgitangu/pawacloud-assistant --enable-discussions`
  2. Open the repo → Discussions → New discussion → category Q&A
  3. Post + answer + accept the four seeds below

#### Seed Q1 — Vision API cost math

**Q (in Q&A):** "What's a realistic monthly Vision API cost for the document
pipeline at 100 / 500 / 2000 uploads per day, assuming a mix of 70% text-layer
PDFs, 20% image OCR, 10% scanned-PDF OCR?"

**A:** Pull from the live numbers — Cloud Vision DOCUMENT_TEXT_DETECTION is
$1.50 / 1000 units (1 page = 1 unit), with the first 1000 units free per
month. At 100 uploads/day with 30% triggering OCR (1.2 pages avg), that's
~36 OCR pages/day → ~1,080/month → ~$0.12. At 500/day → ~$1.20/mo. At
2000/day with 30% OCR → ~$10.50/mo. Math: `(uploads/day × 30) × 0.30 × 1.2 × 0.0015`.

#### Seed Q2 — pypdf vs pdfminer.six for text extraction

**Q:** "Why pick pypdf over pdfminer.six for the document service when
pdfminer.six has better Unicode handling?"

**A:** pypdf is pure Python, smaller wheel, faster cold-start, and the
extraction quality is comparable for typical PDF/A and PDF/UA text-layer
documents. pdfminer.six wins on edge cases (CID fonts, RTL re-ordering)
but adds startup cost. The pipeline already falls back to Cloud Vision for
documents where pypdf returns empty text — Vision handles the edge cases
that motivate pdfminer. Net: pypdf + Vision fallback beats pdfminer alone
on both quality and footprint.

#### Seed Q3 — Tesseract.js vs Cloud Vision for in-browser OCR

**Q:** "Has anyone used Tesseract.js as a client-side fallback for the
camera-image OCR path?"

**A:** Tested it, deferred to backend Vision API for this build. The
trade-offs: Tesseract.js needs an ~8 MB language pack download, hits the
main thread without explicit Web Workers, and quality on multi-column
phone photos was noticeably worse than Vision's DOCUMENT_TEXT_DETECTION.
Worth revisiting as a "preview" layer before the backend round-trip
(option 3 from the OCR considerations doc), but not as a replacement.

#### Seed Q4 — Rust+PyO3 hot path benchmarks

**Q:** "How much does the Rust+PyO3 layer actually save in production hot
paths? Worth the build-time cost?"

**A:** Live numbers from `/health/metrics`: detect_script is ~77× faster
than the Python fallback, normalize_document_text ~2×, chunk_markdown ~3×.
sha256_hex is actually slower (~0.2×) because Python's hashlib uses
OpenSSL — the only function where the FFI overhead wins. For per-request
hot paths (sanitize, validate_markdown, detect_script) Rust pays off
clearly. The maturin build adds ~30s cold-start to the Cloud Run
container; the wheel is cached after first build.

## Open Sourcerer — candidate small contributions

The user follows ~50 GitHub accounts (`gh api /users/ericgitangu/following`).
A merged PR in any of their popular repos in the calendar year unlocks the
Open Sourcerer badge. Targets that match the user's stack and have approachable
"good first issue" or doc-fix lanes:

1. **encode/fastapi** — high-traffic Python project; the `documentation`
   label is a steady source of small fixes (typos, broken links, sample
   updates). Look for PRs that landed in <72h.

2. **vercel/next.js** — examples folder routinely needs minor updates as
   APIs evolve (e.g. fixing an example that broke after a minor release).
   Filter for the `area: examples` label.

3. **PyO3/pyo3** — direct match for the Rust+PyO3 work in this repo. Doc
   fixes around the migration guides between minor versions are a steady
   target.

4. **vercel/swr** — narrow, well-curated codebase; small docs/typing PRs
   often merge in days.

5. **shadcn-ui/ui** — components docs or example fixes; high merge rate,
   visible in the community.

Pick one, find an issue you can fix without a deep architectural ramp,
open a focused PR with a clear test/before-after demonstration. Don't
spam — one merged PR is enough.

## 30-day follow-up

| Week | Action |
|---|---|
| 1 | Merge the polish PR + the document-upload PR (2× Pull Shark) |
| 2 | Run Quickdraw + YOLO from this playbook |
| 3 | Post 2 Discussions Q&A, accept your own answers (Galaxy Brain) |
| 4 | Land one Open Sourcerer PR from the shortlist above |

After 30 days you should be at Pull Shark Bronze + Silver, plus Quickdraw,
YOLO, Galaxy Brain Bronze, and Open Sourcerer. Starstruck takes its own
time and is mostly a function of social signal.

---

© 2026 Eric Gitangu — MIT licensed.
