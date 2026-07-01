# Graph Report - examready  (2026-06-28)

## Corpus Check
- 190 files · ~72,356 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 860 nodes · 2031 edges · 51 communities (44 shown, 7 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 8 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `0e15f0ef`
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
- [[_COMMUNITY_Community 47|Community 47]]
- [[_COMMUNITY_Community 48|Community 48]]
- [[_COMMUNITY_Community 49|Community 49]]
- [[_COMMUNITY_Community 50|Community 50]]

## God Nodes (most connected - your core abstractions)
1. `cn()` - 156 edges
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
- `AdminUserPage()` --calls--> `formatDate()`  [INFERRED]
  src/app/(admin)/admin/users/[id]/page.tsx → src/lib/utils.ts
- `AdminUserPage()` --calls--> `relativeDate()`  [INFERRED]
  src/app/(admin)/admin/users/[id]/page.tsx → src/lib/utils.ts
- `AppLayout()` --calls--> `getActiveExam()`  [INFERRED]
  src/app/(app)/layout.tsx → src/lib/exam.ts
- `NumbersPage()` --calls--> `createClient()`  [EXTRACTED]
  src/app/(app)/numbers/page.tsx → src/lib/supabase/server.ts

## Import Cycles
- None detected.

## Communities (51 total, 7 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.07
Nodes (76): AppLayout(), ARFFRedirect(), GET(), POST(), POST(), POST(), POST(), POST() (+68 more)

### Community 1 - "Community 1"
Cohesion: 0.13
Nodes (10): LoginForm(), Mode, CatalogExam, OnboardingWizard(), Path, Step, OnboardingPage(), BeforeInstallPromptEvent (+2 more)

### Community 2 - "Community 2"
Cohesion: 0.15
Nodes (17): ActiveMode, ARFFClient(), ActiveMode, GKClient(), Props, IQClient(), ScoreSparkline(), Props (+9 more)

### Community 3 - "Community 3"
Cohesion: 0.04
Nodes (45): dependencies, @anthropic-ai/sdk, @base-ui/react, class-variance-authority, clsx, date-fns, @google/genai, groq-sdk (+37 more)

### Community 4 - "Community 4"
Cohesion: 0.15
Nodes (17): Props, ARFFMockExam(), ExamQuestion, Phase, Props, ARFFMockExamResults(), ExamResult, GradeResult (+9 more)

### Community 5 - "Community 5"
Cohesion: 0.12
Nodes (16): AIDrill, AINote, AnnotationType, Difficulty, Enrollment, ExamConfig, FlashcardReview, IQAttempt (+8 more)

### Community 6 - "Community 6"
Cohesion: 0.10
Nodes (25): StatCard(), cn(), Card(), CardAction(), CardContent(), CardDescription(), CardFooter(), CardHeader() (+17 more)

### Community 7 - "Community 7"
Cohesion: 0.21
Nodes (20): AdminContentPage(), AdminAnalytics, AdminUserDetail, AdminUserView, AI_ACTIONS, buildUserMap(), computeStreak(), getAllSubtopicsBrief() (+12 more)

### Community 8 - "Community 8"
Cohesion: 0.09
Nodes (21): aliases, components, hooks, lib, ui, utils, iconLibrary, menuAccent (+13 more)

### Community 9 - "Community 9"
Cohesion: 0.09
Nodes (39): ChatPanel(), ChatPanelProps, Message, WeeklyReviewSection(), extractFile(), isTextFile(), readSourceFile(), readStream() (+31 more)

### Community 10 - "Community 10"
Cohesion: 0.10
Nodes (19): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+11 more)

### Community 11 - "Community 11"
Cohesion: 0.08
Nodes (26): AdminShell(), NAV, titleFor(), AdminGroupLayout(), AnnouncementBanner(), BannerAnnouncement, TINT, BottomNav() (+18 more)

### Community 12 - "Community 12"
Cohesion: 0.08
Nodes (24): DashboardPage(), DailyReview(), Props, DashboardClient(), Props, MetricGrid(), MetricGridProps, QuickActions() (+16 more)

### Community 13 - "Community 13"
Cohesion: 0.11
Nodes (17): Architecture, Core tables, ExamReady — B2C Productization Plan, Key risks & principles, Locked-in product decisions, Phase 0 — Multi-tenant foundation ✅ DONE, Phase 1 — Exam abstraction in the app ✅ DONE, Phase 2 — Auth + onboarding 🚧 IN PROGRESS (+9 more)

### Community 14 - "Community 14"
Cohesion: 0.12
Nodes (9): DropdownMenuCheckboxItem(), DropdownMenuContent(), DropdownMenuItem(), DropdownMenuLabel(), DropdownMenuRadioItem(), DropdownMenuSeparator(), DropdownMenuShortcut(), DropdownMenuSubContent() (+1 more)

### Community 15 - "Community 15"
Cohesion: 0.38
Nodes (5): Mode, NumbersClient(), Props, NumbersPage(), KeyNumber

### Community 16 - "Community 16"
Cohesion: 0.16
Nodes (8): Button(), buttonVariants, DialogContent(), DialogDescription(), DialogFooter(), DialogHeader(), DialogOverlay(), DialogTitle()

### Community 17 - "Community 17"
Cohesion: 0.09
Nodes (25): AdminContentClient(), AdminUserActions(), Props, ROLES, Announcement, AnnouncementsClient(), LEVELS, BankRow (+17 more)

### Community 18 - "Community 18"
Cohesion: 0.13
Nodes (19): ActiveMode, IQClientProps, IQTypeGrid(), IQTypeGridProps, ARFF_CATEGORIES, CATEGORY_COLORS, EXAM_DATE, GK_CATEGORIES (+11 more)

### Community 19 - "Community 19"
Cohesion: 0.14
Nodes (17): AdminActivityFeed(), GlobalActivityExplorer(), Bar, HBars(), MiniBars(), AdminAnalyticsPage(), fmtCost(), fmtTokens() (+9 more)

### Community 20 - "Community 20"
Cohesion: 0.16
Nodes (13): POST(), Choice, CHOICES, Difficulty, DIFFS, DrillQuestion, McqRow, parseCsv() (+5 more)

### Community 21 - "Community 21"
Cohesion: 0.22
Nodes (6): CountdownCard(), CountdownCardProps, ExamCountdown(), TimeLeft, ExamDateDialog(), Props

### Community 22 - "Community 22"
Cohesion: 0.23
Nodes (12): addDays(), cardKey(), INTERVALS, isDue(), nextOnKnown(), nextOnReview(), todayStr(), Card (+4 more)

### Community 23 - "Community 23"
Cohesion: 0.30
Nodes (8): AdminUsersClient(), COLUMNS, SortKey, AdminDashboardPage(), getUsersOverview(), fmtCost(), fmtTokens(), AdminUsersPage()

### Community 24 - "Community 24"
Cohesion: 0.33
Nodes (5): Progress(), ProgressIndicator(), ProgressLabel(), ProgressTrack(), ProgressValue()

### Community 25 - "Community 25"
Cohesion: 0.28
Nodes (5): inter, metadata, viewport, ThemeProvider(), ServiceWorkerRegister()

### Community 26 - "Community 26"
Cohesion: 0.15
Nodes (15): useTopics(), DURATIONS, SessionLogSheet(), SessionLogSheetProps, Props, DURATIONS, SESSION_TYPES, SessionPlanSheet() (+7 more)

### Community 27 - "Community 27"
Cohesion: 0.18
Nodes (8): COUNTS, DIFFS, GKDrillPanel(), Grounding, Phase, Props, Source, SubRef

### Community 28 - "Community 28"
Cohesion: 0.16
Nodes (11): fmtTok(), ProfileClient(), Props, DayConfig, DayState, OFF_DEFAULT, Props, SHIFT_WINDOWS (+3 more)

### Community 29 - "Community 29"
Cohesion: 0.36
Nodes (6): saveDrillResult(), getExamDate(), setExamDate(), fetchSubtopics(), createClient(), DrillSection

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
Cohesion: 0.24
Nodes (10): IQDrillSession(), Phase, Props, Result, IQFigure(), isSvg(), Props, sanitizeSvg() (+2 more)

### Community 43 - "Community 43"
Cohesion: 0.29
Nodes (7): POST(), assertSuperAdmin(), splitSourceSections(), cleanNames(), POST(), POST(), ROLES

### Community 46 - "Community 46"
Cohesion: 0.19
Nodes (6): Card(), DetailSkeleton(), ListSkeleton(), PageSkeleton(), Skeleton(), StatGridSkeleton()

### Community 47 - "Community 47"
Cohesion: 0.25
Nodes (6): BankRow, COUNTS, DIFFS, GenQ, SubRef, OPENROUTER_MODELS

### Community 48 - "Community 48"
Cohesion: 0.22
Nodes (8): Admin Content — Data Flow Diagram, AI Generation Pipeline, Component → API → Database, File Map, Overview, Subtopic Creation Pipeline, Supabase Tables Touched, Token Usage Tracking

### Community 49 - "Community 49"
Cohesion: 0.14
Nodes (16): TopicReaderPage(), flattenTopic(), flattenTopics(), RawTopic, coveragePct(), ProgressPage(), ProgressClient(), ProgressClientProps (+8 more)

### Community 50 - "Community 50"
Cohesion: 0.29
Nodes (6): Avatar(), AvatarBadge(), AvatarFallback(), AvatarGroup(), AvatarGroupCount(), AvatarImage()

## Knowledge Gaps
- **264 isolated node(s):** `$schema`, `style`, `rsc`, `tsx`, `config` (+259 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **7 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `cn()` connect `Community 6` to `Community 1`, `Community 2`, `Community 4`, `Community 9`, `Community 11`, `Community 12`, `Community 14`, `Community 15`, `Community 16`, `Community 17`, `Community 18`, `Community 22`, `Community 23`, `Community 24`, `Community 26`, `Community 27`, `Community 28`, `Community 30`, `Community 36`, `Community 37`, `Community 46`, `Community 47`, `Community 49`, `Community 50`?**
  _High betweenness centrality (0.215) - this node is a cross-community bridge._
- **Why does `createClient()` connect `Community 0` to `Community 1`, `Community 2`, `Community 7`, `Community 43`, `Community 11`, `Community 12`, `Community 15`, `Community 49`, `Community 19`, `Community 20`?**
  _High betweenness centrality (0.066) - this node is a cross-community bridge._
- **Why does `createClient()` connect `Community 29` to `Community 1`, `Community 4`, `Community 37`, `Community 9`, `Community 11`, `Community 12`, `Community 15`, `Community 17`, `Community 21`, `Community 22`, `Community 26`, `Community 28`?**
  _High betweenness centrality (0.015) - this node is a cross-community bridge._
- **What connects `$schema`, `style`, `rsc` to the rest of the system?**
  _264 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.06895986895986896 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.13157894736842105 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.14624505928853754 - nodes in this community are weakly interconnected._