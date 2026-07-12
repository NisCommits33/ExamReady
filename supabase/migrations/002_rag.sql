-- RAG vector store for the AI chat. Applied to the live DB via the Supabase MCP
-- (migration name: rag_content_chunks). Kept here for reference/version control.

create extension if not exists vector;

create table if not exists public.content_chunks (
  id uuid primary key default gen_random_uuid(),
  source_type text not null,          -- study_note|key_points|exam_tips|model_answer|official_source_*|annotation|user_source_*
  topic_id uuid references public.topics(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,  -- set for per-user sources; null for shared
  content text not null,
  content_hash text not null,
  embedding vector(768),
  token_count int,
  created_at timestamptz not null default now(),
  constraint content_chunks_uniq unique nulls not distinct (source_type, topic_id, user_id, content_hash)
);

create index if not exists content_chunks_embedding_idx on public.content_chunks using hnsw (embedding vector_cosine_ops);
create index if not exists content_chunks_topic_idx on public.content_chunks (topic_id);

alter table public.content_chunks enable row level security;
create policy p_read on public.content_chunks for select using (user_id is null or user_id = auth.uid());

create or replace function public.match_chunks(
  query_embedding vector(768),
  match_count int,
  filter_user uuid default null,
  filter_topic uuid default null
) returns table (id uuid, content text, source_type text, topic_id uuid, similarity float)
language sql stable
as $$
  select c.id, c.content, c.source_type, c.topic_id,
         1 - (c.embedding <=> query_embedding) as similarity
  from public.content_chunks c
  where c.embedding is not null
    and (c.user_id is null or c.user_id = filter_user)
    and (filter_topic is null or c.topic_id = filter_topic)
  order by c.embedding <=> query_embedding
  limit match_count
$$;
