# ExamReady — B2C Productization Plan

> Turning a single-user, single-exam study app into a multi-tenant product any student or employee can sign up for, pick a curated exam **or** create their own, and study — with content AI-generated or uploaded.

_Last updated: Phase 1 complete._

---

## Vision

ExamReady started as a personal prep tracker hardcoded to the **CAAN Level 5 Aviation Fire Services** exam. The product goal is to serve **all students and employees** preparing for any competitive exam or certification, while keeping the AI-driven study experience (notes, MCQs, written grading, flashcards, spaced repetition, key-numbers, timetable) that makes it valuable.

## Locked-in product decisions

| Decision | Choice |
|---|---|
| **Audience** | B2C now (individuals self-serve); data model kept **org-ready** for B2B later |
| **Exam model** | **Hybrid** — a curated catalog (CAAN, future Nepal exams) **plus** user-created custom exams |
| **Content source** | **Both** — AI-generated from a syllabus/topic list, and user-uploaded source material |
| **Near-term goal** | Full phased roadmap, foundation-first |

---

## Architecture

### Two pillars
1. **Tenant isolation** — every per-user row scoped by `user_id`, enforced by Postgres **RLS**.
2. **Content / progress split** — *shared exam content* (topics, notes, sources) is authored once and reused by all learners on that exam; *per-user progress/activity* (status, scores, sessions, reviews) is private.

### Core tables
```
profiles        id(=auth.uid), full_name, role, org_id?, onboarded, created_at
exams           id, slug, name, body, description, is_public, created_by?, cloned_from?, config jsonb
exam_sections   id, exam_id, name, kind(mcq_study|aptitude|written), sort_order, config
enrollments     id, user_id, exam_id, exam_date?, is_active
topics          id, exam_id, section_id, name, paper, section, topic_number, subsections, ai_priority   (shared content)
topic_notes     topic_id, study_note, key_points, exam_tips, official_source                            (shared content)
user_topic_progress  user_id, topic_id, status, last_studied, is_flagged, mcq_best_score                (per-user)
... all activity tables (sessions, drill_results, p2_answers, iq_attempts, flashcard_reviews,
    key_numbers, weekly_reports, planned_sessions, shifts, user_annotations, activity_log, user_settings)
    carry user_id with default auth.uid()
```

### Section "kinds" (generalize the old GK / IQ / ARFF pages)
- `mcq_study` — study material + per-topic MCQ drill (was **GK**)
- `aptitude` — typed aptitude drills with figures, no topics (was **IQ**)
- `written` — study + AI-graded written answers + mock exam (was **ARFF / Paper 2**)

### RLS model
- **Content** (`exams`, `exam_sections`, `topics`, `topic_notes`, `key_numbers`): readable if exam `is_public` OR owner OR enrolled; writable by owner/enrolled.
- **Per-user** tables: `user_id = auth.uid()` for all operations.
- **`shift_types`**: shared read-only reference data.

---

## Phased roadmap

### Phase 0 — Multi-tenant foundation ✅ DONE
- `profiles` + auto-create trigger on signup.
- `exams` / `exam_sections` / `enrollments`; CAAN seeded as the first public curated exam (3 sections); existing topics/notes linked to it.
- `user_id` added to all per-user tables, backfilled to the original owner, `default auth.uid()`.
- Content/progress split → new `user_topic_progress` (status/flags/scores moved out of `topics`).
- RLS enabled on all 24 tables + policies. **Isolation verified**: a second account sees only public catalog content, zero personal data.
- App updated (~18 files): `flattenTopic` helper merges per-user progress via RLS-scoped join; AI routes (replan/weekly/rescue) switched to the authenticated client.
- Safety: all tables snapshotted to `_backup_*` before destructive steps.

### Phase 1 — Exam abstraction in the app ✅ DONE
- `getActiveExam()` server helper (active enrollment → exam + sections + date).
- AI routes **exam-aware**: hardcoded "CAAN / Aviation Fire Services" replaced with the active exam's name/body/description injected into prompts.
- **Dynamic nav** from `exam_sections`; sidebar shows the active exam name.
- Generic **`/s/[sectionId]`** route renders the right client by `kind`, with section-scoped topics; legacy `/gk` `/iq` `/arff` redirect to the active exam's matching section.

### Phase 2 — Auth + onboarding 🚧 IN PROGRESS
- **Email/password** signup alongside Google.
- **Onboarding wizard** (gated by `profiles.onboarded`): name & persona → pick a **catalog exam** OR **create custom**.
- **Custom exam builder**: name/body/date + sections; topics via manual add, **AI scaffold from a pasted syllabus** (`/api/ai/scaffold-exam`), or per-topic **source upload** (reuse `extract-*` + `official_source`).
- New users → onboarding; returning users → their active exam's dashboard.

### Phase 3 — Catalog & content operations
- Public **exam catalog** (browse/search/enroll); "fork to customize" via `cloned_from`.
- **Curator admin** to build curated exams + seed sources (generalize `scripts/seed-sources.ts`).
- Shared AI content for curated exams generated **once and cached**; custom-exam content private.

### Phase 4 — Monetization & limits
- Free vs Pro tiers (cap custom exams, AI generations/day, mock exams).
- Per-user rate limiting / usage metering on AI endpoints.
- Billing (Stripe or a local gateway).

### Phase 5 — B2B foundation (later; model already reserved)
- Activate `orgs` + memberships/roles, cohort enrollment, employer admin dashboards, seat billing. No schema rework needed (`org_id` reserved in Phase 0).

---

## Key risks & principles
- **AI cost**: curated-exam content must be shared/cached, not regenerated per user; custom exams bill the creator.
- **Migration safety**: backfill before enabling RLS; keep `_backup_*` until verified.
- **Don't over-build B2B**: reserve columns, build nothing else until there's demand.
- **Content/progress split** is the load-bearing refactor — every topic read flows through `flattenTopic`, every progress write through `user_topic_progress`.

## Verification per phase
- **Phase 0**: 2nd account sees no personal data; original keeps history. ✅
- **Phase 1**: a 2nd curated exam with different sections changes nav, content, and AI prompts. No hardcoded "CAAN" remains.
- **Phase 2**: fresh signup → onboarding → create custom exam from a syllabus → study end-to-end, fully isolated.
- Each phase: `npx next build` green + `graphify update . --force`.
