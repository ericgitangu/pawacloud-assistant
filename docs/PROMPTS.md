# Prompt Engineering

## Model

Gemini 2.5 Flash — chose it because Pawa IT is a Google Cloud Partner.
Free tier covers assessment usage, streaming works out of the box.

## System Prompt

Lives in `backend/app/services/llm_service.py`. Two-shot structure:

1. **Persona** — "PawaCloud Assistant", GCP specialist built by Pawa IT.
   Anchoring to a specific identity keeps responses focused vs. generic.

2. **Tone** — senior cloud architect mentoring a colleague. Not stiff, not casual.
   Africa-aware: regional availability, bandwidth constraints, cost sensitivity.

3. **Format** — markdown with headings, bullets, code blocks with lang tags.
   This renders well in the react-markdown frontend without extra parsing.

4. **Honesty** — "if you don't know, say so." Prevents hallucination on
   pricing details and region availability that change frequently.

## Parameters

| Param | Value | Why |
| ----- | ----- | --- |
| temperature | 0.7 | Technical content needs accuracy but not robotic |
| top_p | 0.9 | Standard nucleus sampling |
| top_k | 40 | Default, works fine |
| max_output_tokens | 2048 | Enough for code examples without burning quota |

## What I tested

- General questions (travel docs, Kenyan news) — should handle gracefully, not refuse
- "Deploy FastAPI to Cloud Run" — should give Dockerfile + gcloud commands
- "What was the impact of the recent floods in Kenya?" — should handle gracefully, not refuse
