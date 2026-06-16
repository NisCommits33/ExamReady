-- ExamReady — Initial Schema
-- Run this in Supabase SQL Editor

-- Enable UUID extension
create extension if not exists "pgcrypto";

-- ── Shifts ────────────────────────────────────────────────────────────────
create table if not exists shifts (
  id           uuid primary key default gen_random_uuid(),
  date         date not null unique,
  type         text not null check (type in ('A', 'B')),
  study_start  time not null,
  study_end    time not null,
  created_at   timestamptz default now()
);

-- ── Topics ────────────────────────────────────────────────────────────────
create table if not exists topics (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  paper         int  not null check (paper in (1, 2)),
  section       text not null check (section in ('A', 'B')),
  topic_number  text not null,
  subsections   text[] not null default '{}',
  status        text not null default 'not_started'
                  check (status in ('not_started', 'in_progress', 'done')),
  ai_priority   int default 5 check (ai_priority between 1 and 10),
  is_flagged    bool default false,
  last_studied  date,
  mcq_best_score int,
  created_at    timestamptz default now()
);

-- ── Study sessions ────────────────────────────────────────────────────────
create table if not exists sessions (
  id            uuid primary key default gen_random_uuid(),
  date          date not null,
  topic_id      uuid references topics(id) on delete set null,
  paper         int check (paper in (1, 2)),
  duration_mins int not null,
  notes         text,
  created_at    timestamptz default now()
);

-- ── AI-planned sessions ───────────────────────────────────────────────────
create table if not exists planned_sessions (
  id                uuid primary key default gen_random_uuid(),
  topic_id          uuid references topics(id) on delete cascade,
  scheduled_date    date not null,
  shift_type        text check (shift_type in ('A', 'B')),
  slot_time         text,
  duration_mins     int not null default 60,
  session_type      text not null default 'study'
                      check (session_type in ('study', 'drill', 'review', 'iq')),
  ai_generated      bool default true,
  completed         bool default false,
  linked_session_id uuid references sessions(id) on delete set null,
  created_at        timestamptz default now()
);

-- ── AI-generated study notes ──────────────────────────────────────────────
create table if not exists topic_notes (
  id                  uuid primary key default gen_random_uuid(),
  topic_id            uuid references topics(id) on delete cascade unique,
  study_note          text,
  key_points          text,
  exam_tips           text,
  model_answer_5mark  text,
  model_answer_10mark text,
  generated_at        timestamptz,
  model_used          text,
  updated_at          timestamptz default now()
);

-- ── User annotations ──────────────────────────────────────────────────────
create table if not exists user_annotations (
  id               uuid primary key default gen_random_uuid(),
  topic_id         uuid references topics(id) on delete cascade,
  content          text not null,
  annotation_type  text default 'note'
                     check (annotation_type in ('note', 'highlight', 'question')),
  created_at       timestamptz default now()
);

-- ── Paper 2 practice answers ──────────────────────────────────────────────
create table if not exists p2_answers (
  id             uuid primary key default gen_random_uuid(),
  topic_id       uuid references topics(id) on delete cascade,
  question_type  text not null check (question_type in ('5mark', '10mark')),
  question_text  text,
  user_answer    text not null,
  ai_feedback    text,
  ai_score       numeric(3,1),
  attempted_at   timestamptz default now()
);

-- ── Topic read history ────────────────────────────────────────────────────
create table if not exists topic_reads (
  id        uuid primary key default gen_random_uuid(),
  topic_id  uuid references topics(id) on delete cascade,
  mode      text check (mode in ('note', 'keypoints', 'tips', 'drill')),
  duration_s int,
  read_at   timestamptz default now()
);

-- ── IQ question bank ──────────────────────────────────────────────────────
create table if not exists iq_questions (
  id             uuid primary key default gen_random_uuid(),
  type           text not null check (type in (
                   'series','analogy','coding_decoding','direction_distance',
                   'logical_reasoning','arithmetic','figure_series',
                   'mirror_water','figure_matrix','venn_diagram')),
  category       text not null check (category in ('verbal','non_verbal','arithmetic')),
  question_text  text not null,
  options        jsonb not null,
  correct_answer text not null,
  difficulty     text default 'medium' check (difficulty in ('easy','medium','hard')),
  explanation    text not null,
  created_at     timestamptz default now()
);

-- ── IQ attempt history ────────────────────────────────────────────────────
create table if not exists iq_attempts (
  id               uuid primary key default gen_random_uuid(),
  question_id      uuid references iq_questions(id) on delete cascade,
  selected_answer  text,
  is_correct       bool,
  time_taken_s     int,
  confidence       text check (confidence in ('sure','unsure','guessing')),
  attempted_at     timestamptz default now()
);

-- ── IQ stats per type ─────────────────────────────────────────────────────
create table if not exists iq_stats (
  id               uuid primary key default gen_random_uuid(),
  type             text not null unique,
  accuracy_pct     numeric(5,2) default 0,
  avg_time_s       numeric(5,1) default 0,
  total_attempted  int default 0,
  last_drilled     date
);

-- ── AI rescue notes ───────────────────────────────────────────────────────
create table if not exists ai_notes (
  id            uuid primary key default gen_random_uuid(),
  topic_id      uuid references topics(id) on delete cascade,
  content       text not null,
  generated_at  timestamptz default now()
);

-- ── AI-generated MCQ drill sets ───────────────────────────────────────────
create table if not exists ai_drills (
  id          uuid primary key default gen_random_uuid(),
  topic_id    uuid references topics(id) on delete cascade,
  questions   jsonb not null,
  session_id  uuid references sessions(id) on delete set null,
  created_at  timestamptz default now()
);

-- ── Weekly AI review reports ──────────────────────────────────────────────
create table if not exists weekly_reports (
  id            uuid primary key default gen_random_uuid(),
  week_start    date not null unique,
  content       text not null,
  risk_topics   text[],
  generated_at  timestamptz default now()
);

-- ── Topic risk flags ──────────────────────────────────────────────────────
create table if not exists topic_flags (
  id           uuid primary key default gen_random_uuid(),
  topic_id     uuid references topics(id) on delete cascade,
  note         text,
  flagged_at   timestamptz default now(),
  resolved     bool default false,
  resolved_at  timestamptz
);

-- ── Indexes ───────────────────────────────────────────────────────────────
create index if not exists idx_sessions_date        on sessions(date);
create index if not exists idx_sessions_topic       on sessions(topic_id);
create index if not exists idx_planned_date         on planned_sessions(scheduled_date);
create index if not exists idx_planned_topic        on planned_sessions(topic_id);
create index if not exists idx_iq_attempts_question on iq_attempts(question_id);
create index if not exists idx_iq_questions_type    on iq_questions(type);
create index if not exists idx_topic_reads_topic    on topic_reads(topic_id);
create index if not exists idx_topic_flags_topic    on topic_flags(topic_id);
create index if not exists idx_p2_answers_topic     on p2_answers(topic_id);
create index if not exists idx_shifts_date          on shifts(date);
