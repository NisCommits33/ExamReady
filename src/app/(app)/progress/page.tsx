import { createClient } from '@/lib/supabase/server'
import { ProgressClient } from '@/components/progress/ProgressClient'
import { TOPIC_WITH_PROGRESS, flattenTopics } from '@/lib/topics'

export default async function ProgressPage() {
  const supabase = await createClient()

  const [{ data: rawTopics }, { data: stats }, { data: attempts }, { data: drills }] = await Promise.all([
    supabase.from('topics').select(TOPIC_WITH_PROGRESS).order('paper').order('section').order('topic_number'),
    supabase.from('iq_stats').select('*'),
    supabase.from('iq_attempts').select('is_correct,confidence').order('attempted_at', { ascending: false }).limit(200),
    supabase.from('drill_results').select('*,topics(name)').order('created_at', { ascending: false }).limit(50),
  ])

  const allTopics = flattenTopics(rawTopics)
  const p1 = allTopics.filter(t => t.paper === 1)
  const p2 = allTopics.filter(t => t.paper === 2)
  const pct = (arr: typeof allTopics) =>
    arr.length ? Math.round((arr.filter(t => t.status === 'done').length / arr.length) * 100) : 0

  const sureAttempts = (attempts ?? []).filter(a => a.confidence === 'sure')
  const sureCorrect = sureAttempts.filter(a => a.is_correct).length
  const surePct = sureAttempts.length ? Math.round((sureCorrect / sureAttempts.length) * 100) : null

  return (
    <ProgressClient
      topics={allTopics}
      p1Coverage={pct(p1)}
      p2Coverage={pct(p2)}
      overallReadiness={Math.round((pct(p1) + pct(p2)) / 2)}
      iqStats={stats ?? []}
      sureCalibration={surePct}
      drills={drills ?? []}
    />
  )
}
