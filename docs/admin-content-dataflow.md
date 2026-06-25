# Admin Content — Data Flow Diagram

## Overview

```
+---------------------+
|   Super Admin       |
|   (Browser)         |
+----------+----------+
           |
           v
+---------------------+       +--------------------+
| /admin/content      |       | layout.tsx         |
| page.tsx (Server)   |<------| requireSuperAdmin  |
+----------+----------+       +--------------------+
           |
           | props: exams, topics, sections, shifts
           v
+---------------------+
| AdminContentClient  |
| (Client Component)  |
+----------+----------+
           |
     +-----+-----+-----+----------+
     |           |      |          |
     v           v      v          v
  Topics    Subtopic  MCQ Bank   Shifts
  CRUD      Manager   Manager    Config
```

## Component → API → Database

```
AdminContentClient.tsx
  |
  |-- POST /api/admin/content
  |     |-- addTopic        --> topics (INSERT)
  |     |-- deleteTopic     --> topics (DELETE)
  |     |-- updateExam      --> exams (UPDATE is_public)
  |     |-- updateShiftType --> shift_types (UPDATE study_start/end)
  |     |-- getTopicSource  --> topic_notes (SELECT official_source)
  |     |-- setTopicSource  --> topic_notes (UPSERT official_source)
  |
  |-- TopicSourceEditor.tsx
  |     |-- File upload (MD/text) --> readSourceFile() in browser
  |     |-- File upload (PDF/img) --> POST /api/ai/extract-source --> OCR
  |     |-- Save                  --> POST /api/admin/content (setTopicSource)
  |
  |-- SubtopicManager.tsx
  |     |-- POST /api/admin/subtopics
  |     |     |-- list            --> subtopics (SELECT)
  |     |     |-- add             --> subtopics (INSERT)
  |     |     |-- addMany         --> subtopics (bulk INSERT)
  |     |     |-- splitFromSource --> topic_notes (SELECT) + subtopics (INSERT)
  |     |     |-- rename          --> subtopics (UPDATE)
  |     |     |-- setDynamic      --> subtopics (UPDATE is_dynamic)
  |     |     |-- reorder         --> subtopics (UPDATE sort_order)
  |     |     |-- delete          --> subtopics (DELETE)
  |     |     |-- deleteMany      --> subtopics (DELETE)
  |     |     |-- deleteAll       --> subtopics (DELETE WHERE topic_id)
  |     |
  |     |-- POST /api/ai/suggest-subtopics
  |           |-- mode: headings  --> regex parse source (no AI)
  |           |-- mode: source    --> Groq AI + uploaded source
  |           |-- mode: note      --> Groq AI + AI note
  |           |-- mode: general   --> Groq AI (model knowledge)
  |
  |-- TopicMcqManager.tsx
        |-- POST /api/admin/mcq
        |     |-- list            --> mcq_questions (SELECT)
        |     |-- import          --> parseMcqInput() + mcq_questions (INSERT)
        |     |-- insertMany      --> mcq_questions (bulk INSERT)
        |     |-- delete          --> mcq_questions (DELETE)
        |     |-- deleteMany      --> mcq_questions (DELETE)
        |     |-- deleteAll       --> mcq_questions (DELETE WHERE topic_id)
        |
        |-- POST /api/ai/generate-mcq
              |-- provider: groq       --> Groq (llama-3.3-70b)
              |-- provider: openrouter --> OpenRouter (model selectable)
              |-- grounding from source.ts --> getMcqGrounding()
              |-- shuffleQuestion() randomizes answer positions
              |-- Admin reviews --> picks questions --> insertMany
```

## AI Generation Pipeline

```
+------------------+     +-------------------+     +------------------+
| Admin selects:   |     | Source Grounding   |     | AI Provider      |
| - subtopic       |---->| getMcqGrounding()  |---->| groqJSON()    or |
| - count (5/10/20)|     |                    |     | openrouterJSON() |
| - difficulty     |     | Checks:            |     |                  |
| - provider       |     | 1. subtopic source |     | Models:          |
| - model (OR)     |     | 2. topic source    |     | Groq: llama-3.3  |
+------------------+     | 3. AI note         |     | OR: admin picks  |
                          | 4. general         |     +--------+---------+
                          +-------------------+              |
                                                              v
                          +-------------------+     +------------------+
                          | Admin Review      |<----| Generated MCQs   |
                          | - checkbox per Q  |     | - shuffled opts  |
                          | - Save to bank    |     | - explanation    |
                          | - Discard         |     | - trap info      |
                          +--------+----------+     +------------------+
                                   |
                                   v
                          +-------------------+
                          | mcq_questions     |
                          | (Supabase)        |
                          +-------------------+
```

## Subtopic Creation Pipeline

```
                    +-------------------+
                    | Topic has source? |
                    +--------+----------+
                       yes   |   no
                  +----------+----------+
                  v                     v
        +-----------------+    +-----------------+
        | Extract from    |    | AI (general)    |
        | uploaded source |    | suggest names   |
        +-----------------+    +-----------------+
          |            |
          v            v
   +-----------+  +-----------+
   | Headings  |  | AI reads  |
   | (no AI,   |  | source &  |
   | regex)    |  | proposes  |
   +-----------+  +-----------+
          |            |
          +-----+------+
                v
        +-----------------+
        | Proposed names  |
        | (checkable UI)  |
        +--------+--------+
                 |  admin picks
                 v
        +-----------------+     +-----------------+
        | subtopics table |---->| Per-subtopic    |
        | (rows created)  |     | MCQ scoping     |
        +-----------------+     | Source splitting |
                                +-----------------+
```

## Token Usage Tracking

```
Every AI call (MCQ gen, subtopic suggest, elaborate, simplify, ask-ai)
  |
  v
+------------------+     +------------------+     +-------------------+
| usageCtx         |---->| recordUsage()    |---->| ai_usage table    |
| { action, tokens }     | provider, model  |     | user_id (RLS)     |
+------------------+     | prompt/completion|     | prompt_tokens     |
                          +------------------+     | completion_tokens |
                                                   | total_tokens      |
  +------------------+                             +-------------------+
  | quotaGuard()     |                                     |
  | (runs before     |<------------------------------------+
  |  every AI route) |  checks monthly total vs allocation
  +------------------+
```

## Supabase Tables Touched

| Table | Operations | By |
|---|---|---|
| `exams` | SELECT, UPDATE (is_public) | content API |
| `topics` | SELECT, INSERT, DELETE | content API |
| `topic_notes` | SELECT, UPSERT (official_source) | content API, source grounding |
| `subtopics` | SELECT, INSERT, UPDATE, DELETE | subtopics API |
| `mcq_questions` | SELECT, INSERT, DELETE | mcq API |
| `shift_types` | SELECT, UPDATE | content API |
| `exam_sections` | SELECT | admin.ts (getSectionsBrief) |
| `ai_usage` | INSERT, SELECT (monthly sum) | usage.ts |
| `profiles` | SELECT (token_allocation) | quotaGuard |

## File Map

| Layer | File | Role |
|---|---|---|
| **Page** | `(admin)/admin/content/page.tsx` | Server data fetch + auth gate |
| **UI** | `AdminContentClient.tsx` | Exam/topic list, toggles, add/delete |
| **UI** | `TopicSourceEditor.tsx` | Upload/edit topic source material |
| **UI** | `SubtopicManager.tsx` | Subtopic CRUD, suggest, split |
| **UI** | `TopicMcqManager.tsx` | MCQ import, AI generate, bank management |
| **API** | `api/admin/content/route.ts` | Topics, exams, shifts, source CRUD |
| **API** | `api/admin/subtopics/route.ts` | Subtopic CRUD + split-from-source |
| **API** | `api/admin/mcq/route.ts` | MCQ bank CRUD |
| **AI API** | `api/ai/generate-mcq/route.ts` | AI MCQ generation (Groq / OpenRouter) |
| **AI API** | `api/ai/suggest-subtopics/route.ts` | AI subtopic suggestion |
| **Lib** | `lib/admin.ts` | Server helpers (requireSuperAdmin, data queries) |
| **Lib** | `lib/source.ts` | Source fetching + grounding block builder |
| **Lib** | `lib/mcq.ts` | CSV/JSON parsing, answer shuffling |
| **Lib** | `lib/groq.ts` | Groq SDK wrapper |
| **Lib** | `lib/openrouter.ts` | OpenRouter fetch wrapper |
| **Lib** | `lib/openrouter-models.ts` | Free model list (client-safe) |
| **Lib** | `lib/usage.ts` | Token tracking + quota enforcement |
| **Lib** | `lib/markdown.ts` | Source section splitting |
