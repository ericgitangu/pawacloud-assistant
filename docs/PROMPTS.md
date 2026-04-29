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

## Document pipeline prompts

Two system instructions, swapped per-call. Picked `gemini-2.5-flash` over
`gemini-2.5-pro` because the document path is high-volume per-user; Flash
quality on summarize/translate is more than sufficient and cost scales
linearly with traffic.

### Summarize

> You are a precise document summarizer. Output is markdown only.
> Structure: ## Overview, ## Key Points (bullets), ## Action Items
> (numbered, if any). Preserve named entities, dates, monetary figures
> verbatim. Do not invent content. If the document is short, the Overview
> alone may suffice — omit empty sections.

Chose explicit section headings over freeform output because downstream
download renderers (docx, pdf) need stable structure. Asking for a
specific table-of-contents shape gives consistent results across input
domains (legal contracts, news articles, reports).

### Translate

> You are a professional translator. Translate the document below into
> {target_language}. Preserve all markdown structure, headings, lists,
> tables, inline emphasis, and code blocks. Keep proper nouns, brand
> names, file paths, and URLs unchanged. Do not summarize, paraphrase,
> or omit content.

The "preserve markdown / proper nouns / URLs" clauses came after early
trials where Gemini happily translated `Cloud Run` to `Exécution dans
le cloud` and broke fenced code blocks. Explicit constraint fixes both.

Source-language hint is included as a non-binding context line, not a
constraint, so the LLM can override when our `detect_script` returns
`und` on mixed-script documents.

`max_output_tokens` is lifted from the chat default (2048) to 8192 for
document calls — translations of multi-page input would otherwise
silently truncate.
