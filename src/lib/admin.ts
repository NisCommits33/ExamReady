import { redirect } from 'next/navigation'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { estimateCost, monthStartISO } from '@/lib/usage'

export interface AdminUserRow {
  id: string
  name: string
  email: string
  role: string
  joined: string | null
  lastSignIn: string | null
  lastActive: string | null
  sessions: number
  hours: number
  topicsDone: number
  activityCount: number
  tokens: number
}

export interface AdminActivityItem {
  id: string
  userId: string | null
  userName: string
  action: string
  topic: string | null
  created_at: string
}

export interface AdminUserDetail {
  id: string
  name: string
  email: string
  role: string
  joined: string | null
  lastSignIn: string | null
  sessions: number
  hours: number
  topicsDone: number
  topicsInProgress: number
  topicsTotal: number
  topicsFlagged: number
  activityCount: number
  lastActive: string | null
  enrollmentActive: boolean | null
  streak: number
  iqAttempts: number
  iqAccuracy: number | null
  drillCount: number
  drillAvg: number | null
  p2Count: number
  p2AvgScore: number | null
  recentP2: { question_type: string; ai_score: number | null; attempted_at: string }[]
  flaggedTopics: string[]
  tokensTotal: number
  tokenCost: number
  tokensByProvider: { provider: string; tokens: number }[]
  tokenReport: {
    allocation: number | null
    monthUsed: number
    monthRemaining: number | null
    pctUsed: number | null
    monthCost: number
    byAction: { action: string; tokens: number; cost: number }[]
    byModel: { provider: string; model: string; tokens: number; cost: number }[]
    byDay: { date: string; tokens: number }[]
    recentCalls: { action: string; model: string; total_tokens: number; created_at: string }[]
  }
  recentActivity: AdminActivityItem[]
  recentSessions: { date: string; duration_mins: number; topic: string | null }[]
}

/** Longest run of consecutive days (ending today/yesterday) that have a session. */
function computeStreak(dates: string[]): number {
  const days = new Set(dates.map(d => d.slice(0, 10)))
  if (days.size === 0) return 0
  let streak = 0
  const cursor = new Date()
  // Allow the streak to "start" today or yesterday.
  if (!days.has(cursor.toISOString().slice(0, 10))) cursor.setDate(cursor.getDate() - 1)
  while (days.has(cursor.toISOString().slice(0, 10))) {
    streak++
    cursor.setDate(cursor.getDate() - 1)
  }
  return streak
}

/** Gate a server component/page to super admins. Redirects to '/' otherwise. Returns the profile. */
export async function requireSuperAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase.from('profiles').select('id,full_name,role').eq('id', user.id).maybeSingle()
  if (profile?.role !== 'super_admin') redirect('/')
  return profile
}

/** Gate an API route to super admins. Returns the current user id, or null if not authorised. */
export async function assertSuperAdmin(): Promise<string | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  return profile?.role === 'super_admin' ? user.id : null
}

/** Build a map of userId → { name, email } from auth + profiles (service role). */
async function buildUserMap(service: Awaited<ReturnType<typeof createServiceClient>>) {
  const [{ data: authData }, { data: profiles }] = await Promise.all([
    service.auth.admin.listUsers({ perPage: 1000 }),
    service.from('profiles').select('id,full_name,role,created_at'),
  ])
  const authUsers = authData?.users ?? []
  const profileMap = new Map((profiles ?? []).map(p => [p.id, p]))
  const map = new Map<string, { name: string; email: string; role: string; joined: string | null; lastSignIn: string | null }>()
  for (const u of authUsers) {
    const p = profileMap.get(u.id)
    map.set(u.id, {
      name: p?.full_name ?? (u.user_metadata?.full_name as string) ?? u.email ?? 'Unknown',
      email: u.email ?? '—',
      role: p?.role ?? 'learner',
      joined: p?.created_at ?? u.created_at ?? null,
      lastSignIn: u.last_sign_in_at ?? null,
    })
  }
  return map
}

/** All users with per-user aggregate stats. */
export async function getUsersOverview(): Promise<AdminUserRow[]> {
  const service = await createServiceClient()
  const userMap = await buildUserMap(service)

  const [{ data: sessions }, { data: activity }, { data: progress }, { data: usage }] = await Promise.all([
    service.from('sessions').select('user_id,duration_mins'),
    service.from('activity_log').select('user_id,created_at'),
    service.from('user_topic_progress').select('user_id,status'),
    service.from('ai_usage').select('user_id,total_tokens'),
  ])

  const agg = new Map<string, { sessions: number; mins: number; activity: number; lastActive: string | null; done: number; tokens: number }>()
  const bump = (id: string | null) => {
    if (!id) return null
    if (!agg.has(id)) agg.set(id, { sessions: 0, mins: 0, activity: 0, lastActive: null, done: 0, tokens: 0 })
    return agg.get(id)!
  }
  for (const s of sessions ?? []) { const a = bump(s.user_id); if (a) { a.sessions++; a.mins += s.duration_mins ?? 0 } }
  for (const r of activity ?? []) { const a = bump(r.user_id); if (a) { a.activity++; if (!a.lastActive || r.created_at > a.lastActive) a.lastActive = r.created_at } }
  for (const p of progress ?? []) { const a = bump(p.user_id); if (a && p.status === 'done') a.done++ }
  for (const u of usage ?? []) { const a = bump(u.user_id); if (a) a.tokens += u.total_tokens ?? 0 }

  return Array.from(userMap.entries()).map(([id, u]) => {
    const a = agg.get(id)
    return {
      id,
      name: u.name,
      email: u.email,
      role: u.role,
      joined: u.joined,
      lastSignIn: u.lastSignIn,
      lastActive: a?.lastActive ?? null,
      sessions: a?.sessions ?? 0,
      hours: Math.round((a?.mins ?? 0) / 60 * 10) / 10,
      topicsDone: a?.done ?? 0,
      activityCount: a?.activity ?? 0,
      tokens: a?.tokens ?? 0,
    }
  }).sort((x, y) => (y.lastActive ?? '').localeCompare(x.lastActive ?? ''))
}

/** Most recent activity across all users. */
export async function getGlobalActivity(limit = 100): Promise<AdminActivityItem[]> {
  const service = await createServiceClient()
  const userMap = await buildUserMap(service)
  const { data } = await service
    .from('activity_log')
    .select('id,user_id,action,meta,created_at')
    .order('created_at', { ascending: false })
    .limit(limit)
  return (data ?? []).map(r => ({
    id: r.id,
    userId: r.user_id,
    userName: r.user_id ? userMap.get(r.user_id)?.name ?? 'Unknown' : 'Unknown',
    action: r.action,
    topic: (r.meta as { topic?: string })?.topic ?? null,
    created_at: r.created_at,
  }))
}

export interface AdminExam {
  id: string
  name: string
  body: string | null
  description: string | null
  is_public: boolean
  topics: number
  sections: number
  enrollments: number
}
export interface AdminShiftType { type: string; study_start: string; study_end: string }
export interface AdminTopicBrief { id: string; exam_id: string | null; name: string; paper: number; section: string; topic_number: string; hasSource: boolean }

export async function getExamsOverview(): Promise<AdminExam[]> {
  const service = await createServiceClient()
  const [{ data: exams }, { data: topics }, { data: sections }, { data: enrollments }] = await Promise.all([
    service.from('exams').select('id,name,body,description,is_public').order('created_at'),
    service.from('topics').select('exam_id'),
    service.from('exam_sections').select('exam_id'),
    service.from('enrollments').select('exam_id'),
  ])
  const count = (rows: { exam_id: string | null }[] | null, id: string) => (rows ?? []).filter(r => r.exam_id === id).length
  return (exams ?? []).map(e => ({
    id: e.id, name: e.name, body: e.body, description: e.description, is_public: e.is_public,
    topics: count(topics, e.id), sections: count(sections, e.id), enrollments: count(enrollments, e.id),
  }))
}

export async function getShiftTypes(): Promise<AdminShiftType[]> {
  const service = await createServiceClient()
  const { data } = await service.from('shift_types').select('type,study_start,study_end').order('type')
  return (data ?? []).map(s => ({ type: s.type, study_start: (s.study_start ?? '').slice(0, 5), study_end: (s.study_end ?? '').slice(0, 5) }))
}

export interface AdminSectionBrief { id: string; exam_id: string; name: string; kind: string }

export async function getSectionsBrief(): Promise<AdminSectionBrief[]> {
  const service = await createServiceClient()
  const { data } = await service.from('exam_sections').select('id,exam_id,name,kind').order('sort_order')
  return (data ?? []) as AdminSectionBrief[]
}

export interface AdminSubtopicBrief { id: string; topic_id: string; name: string }

export async function getAllSubtopicsBrief(): Promise<AdminSubtopicBrief[]> {
  const service = await createServiceClient()
  const { data } = await service.from('subtopics').select('id,topic_id,name').order('sort_order')
  return (data ?? []) as AdminSubtopicBrief[]
}

export async function getAllTopicsBrief(): Promise<AdminTopicBrief[]> {
  const service = await createServiceClient()
  const [{ data }, { data: notes }, { data: sourceFiles }] = await Promise.all([
    service.from('topics').select('id,exam_id,name,paper,section,topic_number').order('topic_number'),
    service.from('topic_notes').select('topic_id,official_source'),
    service.from('topic_source_files').select('topic_id,content'),
  ])
  const withSource = new Set((notes ?? []).filter(n => n.official_source).map(n => n.topic_id))
  for (const row of sourceFiles ?? []) {
    if (row.content?.trim()) withSource.add(row.topic_id)
  }
  return (data ?? []).map(t => ({ ...t, hasSource: withSource.has(t.id) })) as AdminTopicBrief[]
}

export interface AdminAnalytics {
  days: { date: string; activeUsers: number; sessions: number; hours: number }[]
  actionBreakdown: { action: string; count: number }[]
  totalActivity: number
  cacheRows: number
  cacheByMode: { mode: string; count: number }[]
  simplifyHitRate: number | null
  perUserAi: { userId: string; name: string; aiActions: number }[]
  tokens: {
    total: number
    cost: number
    byUser: { userId: string; name: string; tokens: number; cost: number }[]
    byModel: { provider: string; model: string; tokens: number; cost: number }[]
  }
}

const AI_ACTIONS = new Set([
  'generate_note', 'generate_mcq', 'generate_iq', 'generate_gk', 'generate_arff',
  'generate_p2_question', 'grade_answer', 'ai_chat', 'rescue_agent', 'weekly_report',
  'simplify', 'elaborate', 'extract_source', 'extract_numbers', 'extract_note_sections',
  'extract_p2_question', 'scaffold_exam', 'refresh_current_affairs',
])

/** Engagement + AI-usage analytics across the last `days` days. */
export async function getAnalytics(days = 30): Promise<AdminAnalytics> {
  const service = await createServiceClient()
  const since = new Date()
  since.setDate(since.getDate() - (days - 1))
  const sinceStr = since.toISOString().slice(0, 10)
  const userMap = await buildUserMap(service)

  const [{ data: activity }, { data: sessions }, { data: cache }, { data: usage }] = await Promise.all([
    service.from('activity_log').select('user_id,action,meta,created_at').gte('created_at', `${sinceStr}T00:00:00`),
    service.from('sessions').select('user_id,duration_mins,date').gte('date', sinceStr),
    service.from('ai_transforms').select('mode'),
    service.from('ai_usage').select('user_id,provider,model,prompt_tokens,completion_tokens,total_tokens').gte('created_at', `${sinceStr}T00:00:00`),
  ])

  // Per-day buckets
  const dayMap = new Map<string, { users: Set<string>; sessions: number; mins: number }>()
  for (let i = 0; i < days; i++) {
    const d = new Date(since); d.setDate(since.getDate() + i)
    dayMap.set(d.toISOString().slice(0, 10), { users: new Set(), sessions: 0, mins: 0 })
  }
  for (const a of activity ?? []) {
    const k = a.created_at.slice(0, 10)
    if (a.user_id && dayMap.has(k)) dayMap.get(k)!.users.add(a.user_id)
  }
  for (const s of sessions ?? []) {
    const k = s.date.slice(0, 10)
    if (dayMap.has(k)) { const b = dayMap.get(k)!; b.sessions++; b.mins += s.duration_mins ?? 0; if (s.user_id) b.users.add(s.user_id) }
  }
  const daysOut = Array.from(dayMap.entries()).map(([date, b]) => ({
    date, activeUsers: b.users.size, sessions: b.sessions, hours: Math.round(b.mins / 60 * 10) / 10,
  }))

  // Action breakdown
  const actionCounts = new Map<string, number>()
  for (const a of activity ?? []) actionCounts.set(a.action, (actionCounts.get(a.action) ?? 0) + 1)
  const actionBreakdown = Array.from(actionCounts.entries()).map(([action, count]) => ({ action, count })).sort((a, b) => b.count - a.count)

  // Cache stats
  const cacheModeCounts = new Map<string, number>()
  for (const c of cache ?? []) cacheModeCounts.set(c.mode, (cacheModeCounts.get(c.mode) ?? 0) + 1)
  const simplifyEvents = (activity ?? []).filter(a => a.action === 'simplify')
  const simplifyHits = simplifyEvents.filter(a => (a.meta as { cached?: boolean })?.cached).length
  const simplifyHitRate = simplifyEvents.length ? Math.round((simplifyHits / simplifyEvents.length) * 100) : null

  // Per-user AI usage
  const perUser = new Map<string, number>()
  for (const a of activity ?? []) {
    if (a.user_id && AI_ACTIONS.has(a.action)) perUser.set(a.user_id, (perUser.get(a.user_id) ?? 0) + 1)
  }
  const perUserAi = Array.from(perUser.entries())
    .map(([userId, aiActions]) => ({ userId, name: userMap.get(userId)?.name ?? 'Unknown', aiActions }))
    .sort((a, b) => b.aiActions - a.aiActions)

  // Token usage
  const tokByUser = new Map<string, { tokens: number; cost: number }>()
  const tokByModel = new Map<string, { provider: string; model: string; tokens: number; cost: number }>()
  let tokensTotal = 0, costTotal = 0
  for (const r of usage ?? []) {
    const cost = estimateCost(r.model, r.prompt_tokens ?? 0, r.completion_tokens ?? 0)
    tokensTotal += r.total_tokens ?? 0
    costTotal += cost
    if (r.user_id) {
      const u = tokByUser.get(r.user_id) ?? { tokens: 0, cost: 0 }
      u.tokens += r.total_tokens ?? 0; u.cost += cost
      tokByUser.set(r.user_id, u)
    }
    const mk = `${r.provider}:${r.model}`
    const m = tokByModel.get(mk) ?? { provider: r.provider, model: r.model, tokens: 0, cost: 0 }
    m.tokens += r.total_tokens ?? 0; m.cost += cost
    tokByModel.set(mk, m)
  }

  return {
    days: daysOut,
    actionBreakdown,
    totalActivity: activity?.length ?? 0,
    cacheRows: cache?.length ?? 0,
    cacheByMode: Array.from(cacheModeCounts.entries()).map(([mode, count]) => ({ mode, count })),
    simplifyHitRate,
    perUserAi,
    tokens: {
      total: tokensTotal,
      cost: Math.round(costTotal * 10000) / 10000,
      byUser: Array.from(tokByUser.entries())
        .map(([userId, v]) => ({ userId, name: userMap.get(userId)?.name ?? 'Unknown', tokens: v.tokens, cost: Math.round(v.cost * 10000) / 10000 }))
        .sort((a, b) => b.tokens - a.tokens),
      byModel: Array.from(tokByModel.values())
        .map(m => ({ ...m, cost: Math.round(m.cost * 10000) / 10000 }))
        .sort((a, b) => b.tokens - a.tokens),
    },
  }
}

export interface AdminUserView {
  name: string
  email: string
  progress: { name: string; paper: number; section: string; status: string; last_studied: string | null }[]
  planned: { scheduled_date: string; session_type: string; duration_mins: number; topic: string | null }[]
}

/** Read-only snapshot of a user's study state for the "view as" page. */
export async function getUserView(userId: string): Promise<AdminUserView | null> {
  const service = await createServiceClient()
  const userMap = await buildUserMap(service)
  const u = userMap.get(userId)
  if (!u) return null

  const today = new Date().toISOString().slice(0, 10)
  const [{ data: progress }, { data: planned }] = await Promise.all([
    service.from('user_topic_progress').select('status,last_studied,topics(name,paper,section)').eq('user_id', userId),
    service.from('planned_sessions').select('scheduled_date,session_type,duration_mins,topics(name)').eq('user_id', userId).gte('scheduled_date', today).order('scheduled_date').limit(50),
  ])

  const topicName = (row: { topics?: unknown }) => {
    const t = row.topics
    return (Array.isArray(t) ? t[0] : t) as { name: string; paper?: number; section?: string } | null
  }

  return {
    name: u.name,
    email: u.email,
    progress: (progress ?? []).map(p => {
      const t = topicName(p)
      return { name: t?.name ?? 'Topic', paper: t?.paper ?? 0, section: t?.section ?? '', status: p.status, last_studied: p.last_studied }
    }).sort((a, b) => a.name.localeCompare(b.name)),
    planned: (planned ?? []).map(p => ({
      scheduled_date: p.scheduled_date,
      session_type: p.session_type,
      duration_mins: p.duration_mins,
      topic: topicName(p)?.name ?? null,
    })),
  }
}

/** Full activity + stats for a single user. */
export async function getUserDetail(userId: string): Promise<AdminUserDetail | null> {
  const service = await createServiceClient()
  const userMap = await buildUserMap(service)
  const u = userMap.get(userId)
  if (!u) return null

  const [
    { data: sessions }, { data: activity }, { data: progress },
    { data: enrollment }, { data: iqStats }, { data: drills }, { data: p2 }, { data: flagged },
  ] = await Promise.all([
    service.from('sessions').select('date,duration_mins,topics(name)').eq('user_id', userId).order('date', { ascending: false }),
    service.from('activity_log').select('id,user_id,action,meta,created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(100),
    service.from('user_topic_progress').select('status,is_flagged,topics(name)').eq('user_id', userId),
    service.from('enrollments').select('is_active').eq('user_id', userId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
    service.from('iq_stats').select('accuracy_pct,total_attempted').eq('user_id', userId),
    service.from('drill_results').select('score,total').eq('user_id', userId),
    service.from('p2_answers').select('question_type,ai_score,attempted_at').eq('user_id', userId).order('attempted_at', { ascending: false }),
    service.from('user_topic_progress').select('is_flagged,topics(name)').eq('user_id', userId).eq('is_flagged', true),
  ])

  const [{ data: usage }, { data: profileRow }] = await Promise.all([
    service.from('ai_usage').select('action,provider,model,prompt_tokens,completion_tokens,total_tokens,created_at').eq('user_id', userId).order('created_at', { ascending: false }),
    service.from('profiles').select('token_allocation').eq('id', userId).maybeSingle(),
  ])
  const allocation = profileRow?.token_allocation && profileRow.token_allocation > 0 ? profileRow.token_allocation : null
  const monthStart = `${monthStartISO()}T00:00:00Z`

  let tokensTotal = 0, tokenCost = 0
  const provTok = new Map<string, number>()
  let monthUsed = 0, monthCost = 0
  const mAction = new Map<string, { tokens: number; cost: number }>()
  const mModel = new Map<string, { provider: string; model: string; tokens: number; cost: number }>()
  const mDay = new Map<string, number>()
  for (const r of usage ?? []) {
    const tok = r.total_tokens ?? 0
    const cost = estimateCost(r.model, r.prompt_tokens ?? 0, r.completion_tokens ?? 0)
    tokensTotal += tok
    tokenCost += cost
    provTok.set(r.provider, (provTok.get(r.provider) ?? 0) + tok)
    if (r.created_at >= monthStart) {
      monthUsed += tok; monthCost += cost
      const a = mAction.get(r.action) ?? { tokens: 0, cost: 0 }; a.tokens += tok; a.cost += cost; mAction.set(r.action, a)
      const mk = `${r.provider}:${r.model}`
      const m = mModel.get(mk) ?? { provider: r.provider, model: r.model, tokens: 0, cost: 0 }; m.tokens += tok; m.cost += cost; mModel.set(mk, m)
      const day = r.created_at.slice(0, 10); mDay.set(day, (mDay.get(day) ?? 0) + tok)
    }
  }
  const round4 = (n: number) => Math.round(n * 10000) / 10000
  const tokenReport = {
    allocation,
    monthUsed,
    monthRemaining: allocation === null ? null : Math.max(0, allocation - monthUsed),
    pctUsed: allocation === null ? null : Math.min(100, Math.round((monthUsed / allocation) * 100)),
    monthCost: round4(monthCost),
    byAction: Array.from(mAction.entries()).map(([action, v]) => ({ action, tokens: v.tokens, cost: round4(v.cost) })).sort((a, b) => b.tokens - a.tokens),
    byModel: Array.from(mModel.values()).map(m => ({ ...m, cost: round4(m.cost) })).sort((a, b) => b.tokens - a.tokens),
    byDay: Array.from(mDay.entries()).map(([date, tokens]) => ({ date, tokens })).sort((a, b) => a.date.localeCompare(b.date)),
    recentCalls: (usage ?? []).slice(0, 15).map(r => ({ action: r.action, model: r.model, total_tokens: r.total_tokens ?? 0, created_at: r.created_at })),
  }

  const mins = (sessions ?? []).reduce((s, r) => s + (r.duration_mins ?? 0), 0)
  const done = (progress ?? []).filter(p => p.status === 'done').length
  const inProgress = (progress ?? []).filter(p => p.status === 'in_progress').length

  const iqAttempted = (iqStats ?? []).reduce((s, r) => s + (r.total_attempted ?? 0), 0)
  const iqWithData = (iqStats ?? []).filter(r => (r.total_attempted ?? 0) > 0)
  const iqAccuracy = iqWithData.length ? Math.round(iqWithData.reduce((s, r) => s + (r.accuracy_pct ?? 0), 0) / iqWithData.length) : null

  const drillPcts = (drills ?? []).filter(d => (d.total ?? 0) > 0).map(d => (d.score / d.total) * 100)
  const drillAvg = drillPcts.length ? Math.round(drillPcts.reduce((a, b) => a + b, 0) / drillPcts.length) : null

  const p2Scores = (p2 ?? []).map(a => a.ai_score).filter((n): n is number => typeof n === 'number')
  const p2AvgScore = p2Scores.length ? Math.round((p2Scores.reduce((a, b) => a + b, 0) / p2Scores.length) * 10) / 10 : null

  const flagName = (row: { topics?: unknown }) => {
    const t = row.topics
    return (Array.isArray(t) ? t[0]?.name : (t as { name?: string } | null)?.name) ?? null
  }

  return {
    id: userId,
    name: u.name,
    email: u.email,
    role: u.role,
    joined: u.joined,
    lastSignIn: u.lastSignIn,
    sessions: sessions?.length ?? 0,
    hours: Math.round(mins / 60 * 10) / 10,
    topicsDone: done,
    topicsInProgress: inProgress,
    topicsTotal: progress?.length ?? 0,
    topicsFlagged: (flagged ?? []).length,
    activityCount: activity?.length ?? 0,
    lastActive: activity?.[0]?.created_at ?? null,
    enrollmentActive: enrollment ? enrollment.is_active : null,
    streak: computeStreak((sessions ?? []).map(s => s.date)),
    iqAttempts: iqAttempted,
    iqAccuracy,
    drillCount: drills?.length ?? 0,
    drillAvg,
    p2Count: p2?.length ?? 0,
    p2AvgScore,
    recentP2: (p2 ?? []).slice(0, 8).map(a => ({ question_type: a.question_type, ai_score: a.ai_score, attempted_at: a.attempted_at })),
    flaggedTopics: (flagged ?? []).map(flagName).filter((n): n is string => !!n),
    tokensTotal,
    tokenCost: Math.round(tokenCost * 10000) / 10000,
    tokensByProvider: Array.from(provTok.entries()).map(([provider, tokens]) => ({ provider, tokens })).sort((a, b) => b.tokens - a.tokens),
    tokenReport,
    recentActivity: (activity ?? []).map(r => ({
      id: r.id,
      userId: r.user_id,
      userName: u.name,
      action: r.action,
      topic: (r.meta as { topic?: string })?.topic ?? null,
      created_at: r.created_at,
    })),
    recentSessions: (sessions ?? []).slice(0, 30).map(s => ({
      date: s.date,
      duration_mins: s.duration_mins,
      topic: (Array.isArray(s.topics) ? s.topics[0]?.name : (s.topics as { name: string } | null)?.name) ?? null,
    })),
  }
}
