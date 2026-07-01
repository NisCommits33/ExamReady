# Graph Report - examready  (2026-07-01)

## Corpus Check
- 194 files · ~75,574 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 897 nodes · 2125 edges · 48 communities (41 shown, 7 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 8 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `a4ccc766`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 16|Community 16]]
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Community 18|Community 18]]
- [[_COMMUNITY_Community 19|Community 19]]
- [[_COMMUNITY_Community 20|Community 20]]
- [[_COMMUNITY_Community 21|Community 21]]
- [[_COMMUNITY_Community 22|Community 22]]
- [[_COMMUNITY_Community 23|Community 23]]
- [[_COMMUNITY_Community 24|Community 24]]
- [[_COMMUNITY_Community 25|Community 25]]
- [[_COMMUNITY_Community 26|Community 26]]
- [[_COMMUNITY_Community 27|Community 27]]
- [[_COMMUNITY_Community 28|Community 28]]
- [[_COMMUNITY_Community 29|Community 29]]
- [[_COMMUNITY_Community 30|Community 30]]
- [[_COMMUNITY_Community 31|Community 31]]
- [[_COMMUNITY_Community 32|Community 32]]
- [[_COMMUNITY_Community 33|Community 33]]
- [[_COMMUNITY_Community 34|Community 34]]
- [[_COMMUNITY_Community 35|Community 35]]
- [[_COMMUNITY_Community 36|Community 36]]
- [[_COMMUNITY_Community 37|Community 37]]
- [[_COMMUNITY_Community 38|Community 38]]
- [[_COMMUNITY_Community 39|Community 39]]
- [[_COMMUNITY_Community 40|Community 40]]
- [[_COMMUNITY_Community 41|Community 41]]
- [[_COMMUNITY_Community 42|Community 42]]
- [[_COMMUNITY_Community 43|Community 43]]
- [[_COMMUNITY_Community 46|Community 46]]
- [[_COMMUNITY_Community 48|Community 48]]

## God Nodes (most connected - your core abstractions)
1. `cn()` - 159 edges
2. `createClient()` - 65 edges
3. `quotaGuard()` - 43 edges
4. `logActivity()` - 42 edges
5. `createClient()` - 33 edges
6. `Topic` - 32 edges
7. `createServiceClient()` - 22 edges
8. `getExamPromptContext()` - 19 edges
9. `groqJSON()` - 16 edges
10. `relativeDate()` - 16 edges

## Surprising Connections (you probably didn't know these)
- `AdminUserPage()` --calls--> `getUserDetail()`  [INFERRED]
  src/app/(admin)/admin/users/[id]/page.tsx → src/lib/admin.ts
- `AppLayout()` --calls--> `getActiveExam()`  [INFERRED]
  src/app/(app)/layout.tsx → src/lib/exam.ts
- `NumbersPage()` --calls--> `createClient()`  [EXTRACTED]
  src/app/(app)/numbers/page.tsx → src/lib/supabase/server.ts
- `DashboardPage()` --calls--> `createClient()`  [EXTRACTED]
  src/app/(app)/page.tsx → src/lib/supabase/server.ts
- `TimetablePage()` --calls--> `createClient()`  [EXTRACTED]
  src/app/(app)/timetable/page.tsx → src/lib/supabase/server.ts

## Import Cycles
- None detected.

## Communities (48 total, 7 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.07
Nodes (73): AppLayout(), ARFFRedirect(), GET(), POST(), POST(), POST(), POST(), POST() (+65 more)

### Community 1 - "Community 1"
Cohesion: 0.25
Nodes (9): AdminUsersClient(), COLUMNS, SortKey, AdminDashboardPage(), StatCard(), getUsersOverview(), fmtCost(), fmtTokens() (+1 more)

### Community 2 - "Community 2"
Cohesion: 0.22
Nodes (11): ActiveMode, ActiveMode, Flashcards(), ScoreSparkline(), StudyDashboard(), FILTERS, Props, SortKey (+3 more)

### Community 3 - "Community 3"
Cohesion: 0.04
Nodes (45): dependencies, @anthropic-ai/sdk, @base-ui/react, class-variance-authority, clsx, date-fns, @google/genai, groq-sdk (+37 more)

### Community 4 - "Community 4"
Cohesion: 0.21
Nodes (10): ARFFClient(), GKClient(), TopicReaderPage(), IQClient(), flattenTopic(), flattenTopics(), RawTopic, ProgressPage() (+2 more)

### Community 5 - "Community 5"
Cohesion: 0.11
Nodes (19): ActiveExam, AIDrill, AINote, AnnotationType, Difficulty, Enrollment, Exam, ExamConfig (+11 more)

### Community 6 - "Community 6"
Cohesion: 0.11
Nodes (23): cn(), Avatar(), AvatarBadge(), AvatarFallback(), AvatarGroup(), AvatarGroupCount(), AvatarImage(), Checkbox() (+15 more)

### Community 7 - "Community 7"
Cohesion: 0.17
Nodes (15): AdminGroupLayout(), AdminAnalytics, AdminUserDetail, AdminUserView, AI_ACTIONS, buildUserMap(), computeStreak(), getGlobalActivity() (+7 more)

### Community 8 - "Community 8"
Cohesion: 0.09
Nodes (21): aliases, components, hooks, lib, ui, utils, iconLibrary, menuAccent (+13 more)

### Community 9 - "Community 9"
Cohesion: 0.07
Nodes (49): ChatPanel(), GENERAL_PROMPTS, TOPIC_PROMPTS, ChatActions, ChatActionsContext, ChatMessage, ChatProvider(), ChatStateContext (+41 more)

### Community 10 - "Community 10"
Cohesion: 0.10
Nodes (19): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+11 more)

### Community 11 - "Community 11"
Cohesion: 0.05
Nodes (34): AdminShell(), NAV, titleFor(), LoginForm(), Mode, AnnouncementBanner(), BannerAnnouncement, TINT (+26 more)

### Community 12 - "Community 12"
Cohesion: 0.09
Nodes (35): DashboardPage(), ActivityFeed(), CountdownCard(), DailyReview(), Props, DashboardClient(), Props, MetricGrid() (+27 more)

### Community 13 - "Community 13"
Cohesion: 0.11
Nodes (17): Architecture, Core tables, ExamReady — B2C Productization Plan, Key risks & principles, Locked-in product decisions, Phase 0 — Multi-tenant foundation ✅ DONE, Phase 1 — Exam abstraction in the app ✅ DONE, Phase 2 — Auth + onboarding 🚧 IN PROGRESS (+9 more)

### Community 14 - "Community 14"
Cohesion: 0.12
Nodes (9): DropdownMenuCheckboxItem(), DropdownMenuContent(), DropdownMenuItem(), DropdownMenuLabel(), DropdownMenuRadioItem(), DropdownMenuSeparator(), DropdownMenuShortcut(), DropdownMenuSubContent() (+1 more)

### Community 15 - "Community 15"
Cohesion: 0.15
Nodes (10): COUNTS, DIFFS, GKDrillPanel(), Grounding, Phase, Props, Source, SubRef (+2 more)

### Community 16 - "Community 16"
Cohesion: 0.16
Nodes (8): Button(), buttonVariants, DialogContent(), DialogDescription(), DialogFooter(), DialogHeader(), DialogOverlay(), DialogTitle()

### Community 17 - "Community 17"
Cohesion: 0.08
Nodes (27): AdminContentClient(), AdminUserActions(), Props, ROLES, BankRow, McqBankClient(), Sub, SubtopicManager() (+19 more)

### Community 18 - "Community 18"
Cohesion: 0.07
Nodes (36): ActiveMode, IQClientProps, IQDrillSession(), Phase, Props, Result, IQFigure(), isSvg() (+28 more)

### Community 19 - "Community 19"
Cohesion: 0.21
Nodes (12): AdminActivityFeed(), GlobalActivityExplorer(), AdminUserPage(), fmtCost(), fmtTokens(), ACTION_META, actionMeta, AdminActivityItem (+4 more)

### Community 20 - "Community 20"
Cohesion: 0.15
Nodes (14): POST(), Choice, CHOICES, Difficulty, DIFFS, DrillQuestion, JSON_TEMPLATE, McqRow (+6 more)

### Community 21 - "Community 21"
Cohesion: 0.26
Nodes (11): addDays(), cardKey(), INTERVALS, isDue(), nextOnKnown(), nextOnReview(), todayStr(), Card (+3 more)

### Community 22 - "Community 22"
Cohesion: 0.17
Nodes (11): Architecture, Context, Files, Implementation, Key decisions (baked into the plan), Phase 1 — Vector store (Supabase migration), Phase 2 — Embedding + chunking helpers, Phase 3 — Ingestion triggers (+3 more)

### Community 23 - "Community 23"
Cohesion: 0.27
Nodes (9): Props, Props, ARFFPracticeTab(), GradeResult, P2AnswerTab(), Phase, Props, P2Answer (+1 more)

### Community 24 - "Community 24"
Cohesion: 0.33
Nodes (5): Progress(), ProgressIndicator(), ProgressLabel(), ProgressTrack(), ProgressValue()

### Community 25 - "Community 25"
Cohesion: 0.28
Nodes (5): inter, metadata, viewport, ThemeProvider(), ServiceWorkerRegister()

### Community 26 - "Community 26"
Cohesion: 0.05
Nodes (43): Announcement, AnnouncementsClient(), LEVELS, CountdownCardProps, useTopics(), getExamDate(), setExamDate(), Mode (+35 more)

### Community 27 - "Community 27"
Cohesion: 0.24
Nodes (8): ARFFMockExam(), ExamQuestion, Phase, ARFFMockExamResults(), ExamResult, GradeResult, Props, QuestionType

### Community 28 - "Community 28"
Cohesion: 0.36
Nodes (7): Bar, HBars(), MiniBars(), AdminAnalyticsPage(), fmtCost(), fmtTokens(), getAnalytics()

### Community 29 - "Community 29"
Cohesion: 0.32
Nodes (6): RescueCard(), RescueCardProps, Props, Props, ScoreEntry, Topic

### Community 30 - "Community 30"
Cohesion: 0.40
Nodes (5): Tabs(), TabsContent(), TabsList(), tabsListVariants, TabsTrigger()

### Community 31 - "Community 31"
Cohesion: 0.50
Nodes (3): master, root, targets

### Community 32 - "Community 32"
Cohesion: 0.40
Nodes (3): SOURCE_MAP, SOURCES_DIR, supabase

### Community 33 - "Community 33"
Cohesion: 0.40
Nodes (3): SOURCES_DIR, SUBTOPIC_SOURCE_MAP, supabase

### Community 34 - "Community 34"
Cohesion: 0.50
Nodes (3): Deploy on Vercel, Getting Started, Learn More

### Community 37 - "Community 37"
Cohesion: 0.25
Nodes (7): Card(), CardAction(), CardContent(), CardDescription(), CardFooter(), CardHeader(), CardTitle()

### Community 43 - "Community 43"
Cohesion: 0.21
Nodes (15): AdminContentPage(), POST(), assertSuperAdmin(), getAllSubtopicsBrief(), getAllTopicsBrief(), getExamsOverview(), getSectionsBrief(), getShiftTypes() (+7 more)

### Community 46 - "Community 46"
Cohesion: 0.19
Nodes (6): Card(), DetailSkeleton(), ListSkeleton(), PageSkeleton(), Skeleton(), StatGridSkeleton()

### Community 48 - "Community 48"
Cohesion: 0.22
Nodes (8): Admin Content — Data Flow Diagram, AI Generation Pipeline, Component → API → Database, File Map, Overview, Subtopic Creation Pipeline, Supabase Tables Touched, Token Usage Tracking

## Knowledge Gaps
- **279 isolated node(s):** `$schema`, `style`, `rsc`, `tsx`, `config` (+274 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **7 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `cn()` connect `Community 6` to `Community 1`, `Community 2`, `Community 7`, `Community 9`, `Community 11`, `Community 12`, `Community 14`, `Community 15`, `Community 16`, `Community 17`, `Community 18`, `Community 21`, `Community 23`, `Community 24`, `Community 26`, `Community 27`, `Community 30`, `Community 36`, `Community 37`, `Community 46`?**
  _High betweenness centrality (0.213) - this node is a cross-community bridge._
- **Why does `createClient()` connect `Community 0` to `Community 4`, `Community 7`, `Community 43`, `Community 12`, `Community 11`, `Community 19`, `Community 20`, `Community 26`?**
  _High betweenness centrality (0.063) - this node is a cross-community bridge._
- **Why does `createClient()` connect `Community 26` to `Community 9`, `Community 11`, `Community 12`, `Community 15`, `Community 18`, `Community 21`, `Community 23`, `Community 27`?**
  _High betweenness centrality (0.015) - this node is a cross-community bridge._
- **What connects `$schema`, `style`, `rsc` to the rest of the system?**
  _279 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.07199723087573555 - nodes in this community are weakly interconnected._
- **Should `Community 3` be split into smaller, more focused modules?**
  _Cohesion score 0.043478260869565216 - nodes in this community are weakly interconnected._
- **Should `Community 5` be split into smaller, more focused modules?**
  _Cohesion score 0.10526315789473684 - nodes in this community are weakly interconnected._