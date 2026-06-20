# Graph Report - examready  (2026-06-20)

## Corpus Check
- 168 files · ~60,976 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 776 nodes · 1854 edges · 39 communities (32 shown, 7 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 8 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `548c3fd9`
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
- [[_COMMUNITY_Community 25|Community 25]]
- [[_COMMUNITY_Community 28|Community 28]]
- [[_COMMUNITY_Community 29|Community 29]]
- [[_COMMUNITY_Community 30|Community 30]]
- [[_COMMUNITY_Community 32|Community 32]]
- [[_COMMUNITY_Community 33|Community 33]]
- [[_COMMUNITY_Community 34|Community 34]]
- [[_COMMUNITY_Community 35|Community 35]]
- [[_COMMUNITY_Community 36|Community 36]]
- [[_COMMUNITY_Community 38|Community 38]]
- [[_COMMUNITY_Community 39|Community 39]]
- [[_COMMUNITY_Community 40|Community 40]]
- [[_COMMUNITY_Community 41|Community 41]]
- [[_COMMUNITY_Community 42|Community 42]]
- [[_COMMUNITY_Community 46|Community 46]]

## God Nodes (most connected - your core abstractions)
1. `cn()` - 146 edges
2. `createClient()` - 63 edges
3. `quotaGuard()` - 41 edges
4. `logActivity()` - 40 edges
5. `createClient()` - 33 edges
6. `Topic` - 32 edges
7. `createServiceClient()` - 20 edges
8. `getExamPromptContext()` - 17 edges
9. `compilerOptions` - 16 edges
10. `groqJSON()` - 15 edges

## Surprising Connections (you probably didn't know these)
- `AdminUserPage()` --calls--> `getUserDetail()`  [INFERRED]
  src/app/(admin)/admin/users/[id]/page.tsx → src/lib/admin.ts
- `AdminUserViewPage()` --calls--> `getUserView()`  [EXTRACTED]
  src/app/(admin)/admin/users/[id]/view/page.tsx → src/lib/admin.ts
- `AppLayout()` --calls--> `getActiveExam()`  [INFERRED]
  src/app/(app)/layout.tsx → src/lib/exam.ts
- `NumbersPage()` --calls--> `createClient()`  [EXTRACTED]
  src/app/(app)/numbers/page.tsx → src/lib/supabase/server.ts
- `DashboardPage()` --calls--> `createClient()`  [EXTRACTED]
  src/app/(app)/page.tsx → src/lib/supabase/server.ts

## Import Cycles
- None detected.

## Communities (39 total, 7 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.08
Nodes (68): AppLayout(), ARFFRedirect(), GET(), POST(), POST(), POST(), POST(), POST() (+60 more)

### Community 1 - "Community 1"
Cohesion: 0.12
Nodes (18): AdminContentClient(), AdminUserActions(), Props, ROLES, BankRow, McqBankClient(), TopicSourceEditor(), AdminExam (+10 more)

### Community 2 - "Community 2"
Cohesion: 0.05
Nodes (55): ActiveMode, ARFFClient(), Props, ARFFMockExam(), ExamQuestion, Phase, Props, ARFFMockExamResults() (+47 more)

### Community 3 - "Community 3"
Cohesion: 0.04
Nodes (45): dependencies, @anthropic-ai/sdk, @base-ui/react, class-variance-authority, clsx, date-fns, @google/genai, groq-sdk (+37 more)

### Community 4 - "Community 4"
Cohesion: 0.15
Nodes (16): useTopics(), DURATIONS, SessionLogSheet(), SessionLogSheetProps, Props, DURATIONS, SESSION_TYPES, SessionPlanSheet() (+8 more)

### Community 5 - "Community 5"
Cohesion: 0.11
Nodes (18): ActiveExam, AIDrill, AINote, AnnotationType, Difficulty, Enrollment, Exam, ExamConfig (+10 more)

### Community 6 - "Community 6"
Cohesion: 0.09
Nodes (29): cn(), Card(), CardAction(), CardContent(), CardDescription(), CardFooter(), CardHeader(), CardTitle() (+21 more)

### Community 7 - "Community 7"
Cohesion: 0.06
Nodes (34): LoginForm(), Mode, CountdownCard(), CountdownCardProps, saveDrillResult(), getExamDate(), setExamDate(), Mode (+26 more)

### Community 8 - "Community 8"
Cohesion: 0.09
Nodes (21): aliases, components, hooks, lib, ui, utils, iconLibrary, menuAccent (+13 more)

### Community 9 - "Community 9"
Cohesion: 0.07
Nodes (42): ChatPanel(), ChatPanelProps, Message, COUNTS, DIFFS, GKDrillPanel(), Grounding, Phase (+34 more)

### Community 10 - "Community 10"
Cohesion: 0.10
Nodes (19): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+11 more)

### Community 11 - "Community 11"
Cohesion: 0.12
Nodes (17): AdminShell(), NAV, titleFor(), AdminGroupLayout(), AnnouncementBanner(), BannerAnnouncement, TINT, BottomNav() (+9 more)

### Community 12 - "Community 12"
Cohesion: 0.18
Nodes (11): DashboardPage(), DailyReview(), Props, DashboardClient(), Props, QuickActions(), RescueCard(), RescueCardProps (+3 more)

### Community 13 - "Community 13"
Cohesion: 0.11
Nodes (17): Architecture, Core tables, ExamReady — B2C Productization Plan, Key risks & principles, Locked-in product decisions, Phase 0 — Multi-tenant foundation ✅ DONE, Phase 1 — Exam abstraction in the app ✅ DONE, Phase 2 — Auth + onboarding 🚧 IN PROGRESS (+9 more)

### Community 14 - "Community 14"
Cohesion: 0.12
Nodes (9): DropdownMenuCheckboxItem(), DropdownMenuContent(), DropdownMenuItem(), DropdownMenuLabel(), DropdownMenuRadioItem(), DropdownMenuSeparator(), DropdownMenuShortcut(), DropdownMenuSubContent() (+1 more)

### Community 15 - "Community 15"
Cohesion: 0.20
Nodes (10): TodayPlan(), TodayPlanProps, SESSION_TYPE_COLORS, TimetablePage(), SessionPlanSheetProps, DoneSession, TimetableClient(), TimetableClientProps (+2 more)

### Community 16 - "Community 16"
Cohesion: 0.16
Nodes (8): Button(), buttonVariants, DialogContent(), DialogDescription(), DialogFooter(), DialogHeader(), DialogOverlay(), DialogTitle()

### Community 17 - "Community 17"
Cohesion: 0.28
Nodes (9): POST(), POST(), assertSuperAdmin(), getUserView(), parseMcqInput(), POST(), createServiceClient(), POST() (+1 more)

### Community 18 - "Community 18"
Cohesion: 0.17
Nodes (11): ARFF_CATEGORIES, EXAM_DATE, GK_CATEGORIES, GK_QUESTION_TYPES, GK_SUB_TOPICS, GKCategory, GKType, IQCategory (+3 more)

### Community 19 - "Community 19"
Cohesion: 0.08
Nodes (30): AdminActivityFeed(), GlobalActivityExplorer(), Bar, HBars(), MiniBars(), AdminAnalyticsPage(), fmtCost(), fmtTokens() (+22 more)

### Community 20 - "Community 20"
Cohesion: 0.27
Nodes (9): IQDrillSession(), Phase, Result, IQFigure(), isSvg(), Props, sanitizeSvg(), Confidence (+1 more)

### Community 21 - "Community 21"
Cohesion: 0.20
Nodes (9): Choice, CHOICES, Difficulty, DIFFS, DrillQuestion, McqRow, parseCsv(), ParseResult (+1 more)

### Community 22 - "Community 22"
Cohesion: 0.44
Nodes (7): AdminContentPage(), getAllSubtopicsBrief(), getAllTopicsBrief(), getExamsOverview(), getSectionsBrief(), getShiftTypes(), AdminQuestionsPage()

### Community 23 - "Community 23"
Cohesion: 0.40
Nodes (3): Announcement, AnnouncementsClient(), LEVELS

### Community 25 - "Community 25"
Cohesion: 0.33
Nodes (4): inter, metadata, viewport, ThemeProvider()

### Community 28 - "Community 28"
Cohesion: 0.29
Nodes (6): Avatar(), AvatarBadge(), AvatarFallback(), AvatarGroup(), AvatarGroupCount(), AvatarImage()

### Community 29 - "Community 29"
Cohesion: 0.15
Nodes (20): AdminUsersClient(), COLUMNS, SortKey, AdminDashboardPage(), StatCard(), AdminAnalytics, AdminUserDetail, AdminUserRow (+12 more)

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

### Community 46 - "Community 46"
Cohesion: 0.27
Nodes (9): ActiveMode, IQClientProps, Props, IQTypeGrid(), IQTypeGridProps, CATEGORY_COLORS, IQ_QUESTION_TYPES, IQStats (+1 more)

## Knowledge Gaps
- **237 isolated node(s):** `$schema`, `style`, `rsc`, `tsx`, `config` (+232 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **7 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `cn()` connect `Community 6` to `Community 1`, `Community 2`, `Community 4`, `Community 36`, `Community 7`, `Community 9`, `Community 11`, `Community 46`, `Community 15`, `Community 16`, `Community 14`, `Community 19`, `Community 20`, `Community 23`, `Community 28`, `Community 29`, `Community 30`?**
  _High betweenness centrality (0.207) - this node is a cross-community bridge._
- **Why does `createClient()` connect `Community 0` to `Community 2`, `Community 7`, `Community 11`, `Community 12`, `Community 15`, `Community 17`, `Community 19`, `Community 29`?**
  _High betweenness centrality (0.073) - this node is a cross-community bridge._
- **Why does `createClient()` connect `Community 7` to `Community 2`, `Community 4`, `Community 9`, `Community 11`, `Community 15`, `Community 20`, `Community 23`?**
  _High betweenness centrality (0.017) - this node is a cross-community bridge._
- **What connects `$schema`, `style`, `rsc` to the rest of the system?**
  _237 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.07564356435643564 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.12318840579710146 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.05242566510172144 - nodes in this community are weakly interconnected._