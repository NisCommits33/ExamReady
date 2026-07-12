-- Language-specific Markdown source material.
-- Keeps legacy topic_notes.official_source and user_topic_sources as migration fallbacks.

create table if not exists public.topic_source_files (
  id         uuid primary key default gen_random_uuid(),
  topic_id   uuid not null references public.topics(id) on delete cascade,
  language   text not null check (language in ('en', 'ne')),
  content    text not null,
  file_name  text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (topic_id, language)
);

alter table public.topic_source_files enable row level security;

drop policy if exists p_read on public.topic_source_files;
create policy p_read on public.topic_source_files
  for select to authenticated
  using (true);

drop policy if exists p_admin_write on public.topic_source_files;
create policy p_admin_write on public.topic_source_files
  for all to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

create index if not exists idx_topic_source_files_topic
  on public.topic_source_files (topic_id);

create table if not exists public.user_topic_source_files (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  topic_id   uuid not null references public.topics(id) on delete cascade,
  language   text not null check (language in ('en', 'ne')),
  content    text not null,
  file_name  text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, topic_id, language)
);

alter table public.user_topic_source_files enable row level security;

drop policy if exists p_owner on public.user_topic_source_files;
create policy p_owner on public.user_topic_source_files
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create index if not exists idx_user_topic_source_files_topic
  on public.user_topic_source_files (topic_id);

insert into public.topic_source_files (topic_id, language, content, file_name, updated_at)
select topic_id, 'en', official_source, 'legacy-official-source.md', coalesce(updated_at, now())
from public.topic_notes
where official_source is not null and btrim(official_source) <> ''
on conflict (topic_id, language) do nothing;

do $$
begin
  if to_regclass('public.user_topic_sources') is not null then
    insert into public.user_topic_source_files (user_id, topic_id, language, content, file_name, updated_at)
    select user_id, topic_id, 'en', content, 'legacy-user-source.md', coalesce(updated_at, now())
    from public.user_topic_sources
    where content is not null and btrim(content) <> ''
    on conflict (user_id, topic_id, language) do nothing;
  end if;
end $$;
