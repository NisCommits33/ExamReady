# Graph Report - examready  (2026-06-20)

## Corpus Check
- 163 files · ~58,008 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 743 nodes · 1777 edges · 44 communities (34 shown, 10 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 8 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `ba326057`
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
- [[_COMMUNITY_Community 24|Community 24]]
- [[_COMMUNITY_Community 25|Community 25]]
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
- [[_COMMUNITY_Community 44|Community 44]]
- [[_COMMUNITY_Community 46|Community 46]]
- [[_COMMUNITY_Community 49|Community 49]]

## God Nodes (most connected - your core abstractions)
1. `cn()` - 145 edges
2. `createClient()` - 61 edges
3. `quotaGuard()` - 41 edges
4. `logActivity()` - 40 edges
5. `createClient()` - 33 edges
6. `Topic` - 31 edges
7. `getExamPromptContext()` - 17 edges
8. `compilerOptions` - 16 edges
9. `groqJSON()` - 15 edges
10. `createServiceClient()` - 15 edges

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

## Communities (44 total, 10 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.08
Nodes (68): AppLayout(), ARFFRedirect(), GET(), POST(), POST(), POST(), POST(), POST() (+60 more)

### Community 1 - "Community 1"
Cohesion: 0.31
Nodes (8): OPTIONS, StatusToggle(), StatusToggleProps, Props, Tab, TopicNote, TopicStatus, UserAnnotation

### Community 2 - "Community 2"
Cohesion: 0.22
Nodes (11): ActiveMode, ActiveMode, ScoreSparkline(), ScoreEntry, StudyDashboard(), FILTERS, Props, SortKey (+3 more)

### Community 3 - "Community 3"
Cohesion: 0.04
Nodes (45): dependencies, @anthropic-ai/sdk, @base-ui/react, class-variance-authority, clsx, date-fns, @google/genai, groq-sdk (+37 more)

### Community 4 - "Community 4"
Cohesion: 0.07
Nodes (37): TodayPlan(), TodayPlanProps, useTopics(), SESSION_TYPE_COLORS, addDays(), cardKey(), INTERVALS, isDue() (+29 more)

### Community 5 - "Community 5"
Cohesion: 0.12
Nodes (16): AIDrill, AINote, AnnotationType, Difficulty, Enrollment, ExamConfig, FlashcardReview, IQAttempt (+8 more)

### Community 6 - "Community 6"
Cohesion: 0.12
Nodes (22): cn(), Card(), CardAction(), CardContent(), CardDescription(), CardFooter(), CardHeader(), CardTitle() (+14 more)

### Community 7 - "Community 7"
Cohesion: 0.16
Nodes (11): fmtTok(), ProfileClient(), Props, DayConfig, DayState, OFF_DEFAULT, Props, SHIFT_WINDOWS (+3 more)

### Community 8 - "Community 8"
Cohesion: 0.09
Nodes (21): aliases, components, hooks, lib, ui, utils, iconLibrary, menuAccent (+13 more)

### Community 9 - "Community 9"
Cohesion: 0.13
Nodes (22): ChatPanel(), ChatPanelProps, Message, readStream(), Flashcards(), LoadingStream(), LoadingStreamProps, StreamingSkeleton() (+14 more)

### Community 10 - "Community 10"
Cohesion: 0.10
Nodes (19): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+11 more)

### Community 11 - "Community 11"
Cohesion: 0.19
Nodes (11): AnnouncementBanner(), BannerAnnouncement, TINT, BottomNav(), KIND_ICON, NavSection, Shell(), KIND_ICON (+3 more)

### Community 12 - "Community 12"
Cohesion: 0.23
Nodes (6): CountdownCard(), CountdownCardProps, ExamCountdown(), TimeLeft, ExamDateDialog(), Props

### Community 13 - "Community 13"
Cohesion: 0.11
Nodes (17): Architecture, Core tables, ExamReady — B2C Productization Plan, Key risks & principles, Locked-in product decisions, Phase 0 — Multi-tenant foundation ✅ DONE, Phase 1 — Exam abstraction in the app ✅ DONE, Phase 2 — Auth + onboarding 🚧 IN PROGRESS (+9 more)

### Community 14 - "Community 14"
Cohesion: 0.12
Nodes (9): DropdownMenuCheckboxItem(), DropdownMenuContent(), DropdownMenuItem(), DropdownMenuLabel(), DropdownMenuRadioItem(), DropdownMenuSeparator(), DropdownMenuShortcut(), DropdownMenuSubContent() (+1 more)

### Community 15 - "Community 15"
Cohesion: 0.47
Nodes (4): AdminShell(), NAV, titleFor(), ThemeToggle()

### Community 16 - "Community 16"
Cohesion: 0.16
Nodes (8): Button(), buttonVariants, DialogContent(), DialogDescription(), DialogFooter(), DialogHeader(), DialogOverlay(), DialogTitle()

### Community 17 - "Community 17"
Cohesion: 0.53
Nodes (4): getExamDate(), setExamDate(), fetchSubtopics(), createClient()

### Community 18 - "Community 18"
Cohesion: 0.33
Nodes (5): Progress(), ProgressIndicator(), ProgressLabel(), ProgressTrack(), ProgressValue()

### Community 19 - "Community 19"
Cohesion: 0.09
Nodes (27): AdminActivityFeed(), GlobalActivityExplorer(), DashboardPage(), ActivityFeed(), DailyReview(), Props, DashboardClient(), Props (+19 more)

### Community 20 - "Community 20"
Cohesion: 0.19
Nodes (14): Props, ExamQuestion, Props, ARFFPracticeTab(), Props, Props, Props, GradeResult (+6 more)

### Community 21 - "Community 21"
Cohesion: 0.80
Nodes (3): extractFile(), isTextFile(), readSourceFile()

### Community 24 - "Community 24"
Cohesion: 0.21
Nodes (8): ARFFMockExam(), Phase, ARFFMockExamResults(), ExamResult, GradeResult, Props, saveDrillResult(), DrillSection

### Community 25 - "Community 25"
Cohesion: 0.33
Nodes (4): inter, metadata, viewport, ThemeProvider()

### Community 27 - "Community 27"
Cohesion: 0.33
Nodes (5): CatalogExam, OnboardingWizard(), Path, Step, OnboardingPage()

### Community 28 - "Community 28"
Cohesion: 0.29
Nodes (6): Avatar(), AvatarBadge(), AvatarFallback(), AvatarGroup(), AvatarGroupCount(), AvatarImage()

### Community 29 - "Community 29"
Cohesion: 0.05
Nodes (58): AdminContentClient(), AdminUserActions(), Props, ROLES, AdminUsersClient(), COLUMNS, SortKey, Announcement (+50 more)

### Community 30 - "Community 30"
Cohesion: 0.40
Nodes (5): Tabs(), TabsContent(), TabsList(), tabsListVariants, TabsTrigger()

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
Cohesion: 0.40
Nodes (4): GKDrillPanel(), Phase, Question, Subtopic

### Community 44 - "Community 44"
Cohesion: 0.38
Nodes (5): Mode, NumbersClient(), Props, NumbersPage(), KeyNumber

### Community 46 - "Community 46"
Cohesion: 0.06
Nodes (45): ARFFClient(), GKClient(), TopicReaderPage(), ActiveMode, IQClient(), IQClientProps, IQDrillSession(), Phase (+37 more)

## Knowledge Gaps
- **226 isolated node(s):** `$schema`, `style`, `rsc`, `tsx`, `config` (+221 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **10 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `cn()` connect `Community 6` to `Community 1`, `Community 2`, `Community 4`, `Community 7`, `Community 9`, `Community 11`, `Community 14`, `Community 15`, `Community 16`, `Community 18`, `Community 19`, `Community 20`, `Community 22`, `Community 24`, `Community 27`, `Community 28`, `Community 29`, `Community 30`, `Community 31`, `Community 36`, `Community 37`, `Community 44`, `Community 46`, `Community 49`?**
  _High betweenness centrality (0.206) - this node is a cross-community bridge._
- **Why does `createClient()` connect `Community 0` to `Community 4`, `Community 44`, `Community 46`, `Community 19`, `Community 27`, `Community 29`?**
  _High betweenness centrality (0.070) - this node is a cross-community bridge._
- **Why does `createClient()` connect `Community 17` to `Community 1`, `Community 4`, `Community 7`, `Community 9`, `Community 11`, `Community 12`, `Community 44`, `Community 46`, `Community 15`, `Community 20`, `Community 24`, `Community 27`, `Community 29`, `Community 31`?**
  _High betweenness centrality (0.019) - this node is a cross-community bridge._
- **What connects `$schema`, `style`, `rsc` to the rest of the system?**
  _226 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.07524752475247524 - nodes in this community are weakly interconnected._
- **Should `Community 3` be split into smaller, more focused modules?**
  _Cohesion score 0.043478260869565216 - nodes in this community are weakly interconnected._
- **Should `Community 4` be split into smaller, more focused modules?**
  _Cohesion score 0.06588235294117648 - nodes in this community are weakly interconnected._