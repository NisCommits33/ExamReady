import { createClient } from '@/lib/supabase/server'
import { DashboardClient } from '@/components/dashboard/DashboardClient'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const today = new Date().toISOString().split('T')[0]

  const [shift, planned, sessions, topics, report, flags, activity, dueCards, numbers] = await Promise.all([
    supabase.from('shifts').select('type,study_start,study_end,shift_types(study_start,study_end)').eq('date', today).maybeSingle(),
    supabase.from('planned_sessions').select('*,topics(name,paper,section)').eq('scheduled_date', today).order('slot_time'),
    supabase.from('sessions').select('duration_mins,created_at'),
    supabase.from('topics').select('id,name,paper,ai_priority,user_topic_progress(status,is_flagged)'),
    supabase.from('weekly_reports').select('*').order('week_start', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('topic_flags').select('topic_id,topics(name)').eq('resolved', false).limit(5),
    supabase.from('activity_log').select('*').order('created_at', { ascending: false }).limit(6),
    supabase.from('flashcard_reviews').select('card_key', { count: 'exact', head: true }).lte('due_date', today),
    supabase.from('key_numbers').select('id', { count: 'exact', head: true }),
  ])

  const allTopics = (topics.data ?? []).map(t => {
    const raw = (t as { user_topic_progress?: unknown }).user_topic_progress
    const prog = (Array.isArray(raw) ? raw[0] : raw) as { status?: string; is_flagged?: boolean } | null
    return { id: t.id, name: t.name, paper: t.paper, ai_priority: t.ai_priority, status: prog?.status ?? 'not_started', is_flagged: prog?.is_flagged ?? false }
  })
  const p1 = allTopics.filter(t => t.paper === 1)
  const p2 = allTopics.filter(t => t.paper === 2)
  const pct = (arr: typeof allTopics) =>
    arr.length ? Math.round((arr.filter(t => t.status === 'done').length / arr.length) * 100) : 0
  const totalMins = (sessions.data ?? []).reduce((s: number, r: { duration_mins: number }) => s + r.duration_mins, 0)
  const overallReadiness = Math.round((pct(p1) + pct(p2)) / 2)

  const name = user?.user_metadata?.full_name?.split(' ')[0] ?? 'Nischal'

  const shiftRow = shift.data as { type: string; study_start?: string | null; study_end?: string | null; shift_types?: unknown } | null
  const st = shiftRow ? (Array.isArray(shiftRow.shift_types) ? shiftRow.shift_types[0] : shiftRow.shift_types) as { study_start: string; study_end: string } | null : null
  const todayShift = shiftRow
    ? { type: shiftRow.type, study_start: shiftRow.study_start ?? st?.study_start ?? '', study_end: shiftRow.study_end ?? st?.study_end ?? '' }
    : null

  return (
    <DashboardClient
      name={name}
      todayShift={todayShift}
      todayPlanned={planned.data ?? []}
      sessionCount={sessions.data?.length ?? 0}
      totalHours={Math.round(totalMins / 60 * 10) / 10}
      p1Coverage={pct(p1)}
      p2Coverage={pct(p2)}
      overallReadiness={overallReadiness}
      flaggedTopics={allTopics.filter(t => t.is_flagged)}
      weeklyReport={report.data}
      activities={activity.data ?? []}
      dueCardCount={dueCards.count ?? 0}
      numberCount={numbers.count ?? 0}
    />
  )
}
