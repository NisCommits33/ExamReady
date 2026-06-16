import { createClient } from '@/lib/supabase/server'
import { DashboardClient } from '@/components/dashboard/DashboardClient'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const today = new Date().toISOString().split('T')[0]

  const [shift, planned, sessions, topics, report, flags] = await Promise.all([
    supabase.from('shifts').select('type,study_start,study_end').eq('date', today).maybeSingle(),
    supabase.from('planned_sessions').select('*,topics(name,paper,section)').eq('scheduled_date', today).order('slot_time'),
    supabase.from('sessions').select('duration_mins,created_at'),
    supabase.from('topics').select('id,name,paper,status,is_flagged,ai_priority'),
    supabase.from('weekly_reports').select('*').order('week_start', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('topic_flags').select('topic_id,topics(name)').eq('resolved', false).limit(5),
  ])

  const allTopics = topics.data ?? []
  const p1 = allTopics.filter(t => t.paper === 1)
  const p2 = allTopics.filter(t => t.paper === 2)
  const pct = (arr: typeof allTopics) =>
    arr.length ? Math.round((arr.filter(t => t.status === 'done').length / arr.length) * 100) : 0
  const totalMins = (sessions.data ?? []).reduce((s: number, r: { duration_mins: number }) => s + r.duration_mins, 0)
  const overallReadiness = Math.round((pct(p1) + pct(p2)) / 2)

  const name = user?.user_metadata?.full_name?.split(' ')[0] ?? 'Nischal'

  return (
    <DashboardClient
      name={name}
      todayShift={shift.data}
      todayPlanned={planned.data ?? []}
      sessionCount={sessions.data?.length ?? 0}
      totalHours={Math.round(totalMins / 60 * 10) / 10}
      p1Coverage={pct(p1)}
      p2Coverage={pct(p2)}
      overallReadiness={overallReadiness}
      flaggedTopics={allTopics.filter(t => t.is_flagged)}
      weeklyReport={report.data}
    />
  )
}
