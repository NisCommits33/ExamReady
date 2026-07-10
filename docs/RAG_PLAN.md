# RAG for the ExamReady AI chat (and beyond)

## Context

The "Ask AI" chat currently grounds each answer on a blind `study_note.slice(0, 1200)` for a single topic ([api/ai/chat/route.ts:13-24](../src/app/api/ai/chat/route.ts)). This truncates long notes, ignores everything except one topic, and never touches the richer content the app already holds — `key_points`, `exam_tips`, model answers, user annotations, IQ questions, and the uploaded files under `Sources/`.

Goal: replace the naive slice with **retrieval-augmented generation** — embed the app's study content into a vector index and, at chat time, retrieve only the passages semantically relevant to the user's question (current-topic-first, but cross-topic capable). The whole thing fits the existing stack with **no new infrastructure**: Supabase Postgres becomes the vector store via `pgvector`, and the already-integrated Gemini SDK provides embeddings. Groq streaming stays exactly as-is.

Out of scope: swapping the chat LLM, reranking models, or a separate vector DB service.

## Architecture

```
Ingestion (write path)          Retrieval (chat path)
─────────────────────           ─────────────────────
content field ─chunk─┐          user question
        │            │                │ embed (Gemini)
     embed (Gemini)  │                ▼
        │            │          match_chunks() RPC  ── pgvector cosine
        ▼            │                │  (top-k, topic-boosted)
  content_chunks ◄───┘                ▼
   (pgvector)                  inject passages → system prompt → groqStream()
```

## Implementation

### Phase 1 — Vector store (Supabase migration)
New migration `supabase/migrations/002_rag.sql`:
- `create extension if not exists vector;`
- Table `content_chunks`:
  - `id uuid pk`, `source_type text` (`study_note|key_points|exam_tips|model_answer|annotation|iq_question|source_file`), `topic_id uuid references topics(id) on delete cascade` (nullable), `content text`, `content_hash text`, `embedding vector(768)`, `token_count int`, `created_at timestamptz`.
  - HNSW index: `create index on content_chunks using hnsw (embedding vector_cosine_ops);`
  - `unique (source_type, topic_id, content_hash)` so re-ingesting is idempotent.
- RLS mirroring the existing tables in `001_initial.sql`; retrieval runs server-side (service role) so reads aren't user-blocked.
- `match_chunks(query_embedding vector(768), match_count int, filter_topic uuid default null)` SQL function returning `content, source_type, topic_id, 1 - (embedding <=> query_embedding) as similarity`, ordered by `embedding <=> query_embedding`, limited to `match_count`.

### Phase 2 — Embedding + chunking helpers
- **`src/lib/openrouter.ts`** — add `openrouterEmbed(texts: string[]): Promise<number[][]>` hitting OpenRouter's OpenAI-compatible `/embeddings` endpoint. Default model `baai/bge-base-en-v1.5` (natively 768 dims, ~$0.005/1M tokens — effectively free), overridable via `OPENROUTER_EMBED_MODEL` (+ optional `OPENROUTER_EMBED_DIMS` for Matryoshka models like `openai/text-embedding-3-small`). Reuses the existing `OPENROUTER_API_KEY` — **no Gemini key needed; Groq has no embeddings endpoint**. Usage via `recordUsage('openrouter', model, 'embed', …)` ([usage.ts:30](../src/lib/usage.ts)); `PRICING` extended.
- **New `src/lib/rag.ts`** — the ingestion/retrieval core:
  - `chunk(text): string[]` — split markdown on headings, then pack to ~500–800 tokens with ~15% overlap (notes are markdown; preserve heading context per chunk).
  - `ingestTopic(supabase, topicId)` — pull the topic's `topic_notes` fields + `user_annotations`, chunk each, compute `content_hash`, skip unchanged, embed new chunks in batches, upsert into `content_chunks`.
  - `retrieve(query, { topicId, k })` — `embed([query])`, call `match_chunks` (fetch ~2×k, boost/prepend current-topic hits, keep top-k), return passages + a formatted grounding block (reuse the style of `sourceGroundingBlock` in [lib/source.ts](../src/lib/source.ts)).

### Phase 3 — Ingestion triggers
- **Backfill script** `scripts/backfill-embeddings.ts` (one-off, service-role client) — iterate all `topic_notes` and files under `Sources/` (read via [readSourceFile](../src/lib/source-file.ts) / the OCR route for PDFs), call `ingestTopic` / chunk+embed. Idempotent via `content_hash`.
- **Incremental** — after a note is (re)generated/saved, re-embed that topic. The note is persisted client-side after streaming from [generate-note/route.ts](../src/app/api/ai/generate-note/route.ts); add a lightweight `POST /api/ai/ingest` route (or call `ingestTopic` from the existing save path) so the index never goes stale. Same for annotation create/update.

### Phase 4 — Wire retrieval into the chat route
In [api/ai/chat/route.ts](../src/app/api/ai/chat/route.ts): replace the `study_note.slice(0, 1200)` block with `retrieve(lastUserMessage, { topicId, k: 6 })`, inject the returned grounding block into the existing `system` prompt, and leave `groqStream(...)` untouched. When retrieval returns nothing (e.g. general chat with no matches), fall back to today's behaviour so nothing regresses. Optionally log matched `source_type`/`similarity` behind a debug flag to tune quality before trusting it in production.

## Key decisions (baked into the plan)
| Decision | Choice |
|---|---|
| Vector store | Supabase `pgvector` (no new service) |
| Embedding model | OpenRouter `baai/bge-base-en-v1.5` @ 768 dims, ~$0.005/1M (reuses existing OPENROUTER_API_KEY; no Gemini; Groq has no embeddings) |
| When to embed | On note/annotation write + one-off backfill — never on read (cost control) |
| Retrieval scope | Current-topic-boosted, cross-topic fallback; degrades to naive slice if empty |
| Idempotency | `content_hash` unique constraint; skip unchanged chunks |
| Usage accounting | Embedding calls go through `recordUsage` / `quotaGuard` like all AI calls |

## Files
- **New**: `supabase/migrations/002_rag.sql`, `examready/src/lib/rag.ts`, `examready/scripts/backfill-embeddings.ts`, `examready/src/app/api/ai/ingest/route.ts`, `examready/docs/RAG_PLAN.md` (this doc)
- **Modify**: `examready/src/lib/gemini.ts` (add `embed`), `examready/src/lib/usage.ts` (`PRICING` entry), `examready/src/app/api/ai/chat/route.ts` (slice → `retrieve`), the note/annotation save path (trigger `ingestTopic`)
- **Reuse**: `recordUsage`/`quotaGuard` ([usage.ts](../src/lib/usage.ts)), Gemini client ([gemini.ts](../src/lib/gemini.ts)), `getTopicSource`/`sourceGroundingBlock` ([lib/source.ts](../src/lib/source.ts)), `readSourceFile` ([source-file.ts](../src/lib/source-file.ts)), `groqStream` ([groq.ts](../src/lib/groq.ts))
- After code changes: `graphify update .`

## Verification
1. **Migration**: apply `002_rag.sql` (Supabase MCP `apply_migration` or CLI); confirm `vector` extension, `content_chunks`, HNSW index, and `match_chunks` exist via `list_tables` / `list_extensions`.
2. **Backfill**: run `scripts/backfill-embeddings.ts`; confirm `content_chunks` row count ≈ chunk count and no null embeddings.
3. **Retrieval unit check**: a temp script calling `retrieve("<known topic question>", { topicId })` returns passages from the right topic with descending `similarity`.
4. **Chat end-to-end** (`cd examready && npm run dev`): ask a topic question whose answer lives *deep* in a long note (beyond 1200 chars) → answer now reflects it. Ask a cross-topic question from the global chat → relevant passages retrieved. Confirm token/quota toasts still fire (embedding + chat both recorded).
5. **Freshness**: regenerate a note, then ask about the new content → retrieval reflects the update (incremental ingest fired).
6. **No-regression**: with retrieval returning nothing, chat still answers via the fallback path.
7. `npm run lint` / `npm run build` pass.
