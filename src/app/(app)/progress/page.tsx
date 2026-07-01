import { createClient } from '@/lib/supabase/server'
import { format } from 'date-fns'
import { ProgressClient } from '@/components/progress/ProgressClient'
import { TOPIC_WITH_PROGRESS, flattenTopics } from '@/lib/topics'

export default async function ProgressPage() {
  const supabase = await createClient()
  const today = format(new Date(), 'yyyy-MM-dd')

  const [{ data: rawTopics }, { data: stats }, { data: attempts }, { data: drills }, { count: dueCount }, { data: reps }, { count: explainCount }] = await Promise.all([
    supabase.from('topics').select(TOPIC_WITH_PROGRESS).order('paper').order('section').order('topic_number'),
    supabase.from('iq_stats').select('*'),
    supabase.from('iq_attempts').select('is_correct,confidence').order('attempted_at', { ascending: false }).limit(200),
    supabase.from('drill_results').select('*,topics(name)').order('created_at', { ascending: false }).limit(50),
    supabase.from('flashcard_reviews').select('card_key', { count: 'exact', head: true }).lte('due_date', today),
    supabase.from('recall_reps').select('topic_id,streak').order('created_at', { ascending: false }).limit(500),
    supabase.from('explanations').select('id', { count: 'exact', head: true }),
  ])

  // Latest streak per topic → how many topics have reached recall-by-doing "fluency" (3+ in a row).
  const latestStreak = new Map<string, number>()
  for (const r of reps ?? []) if (r.topic_id && !latestStreak.has(r.topic_id)) latestStreak.set(r.topic_id, r.streak ?? 0)
  const fluentTopics = [...latestStreak.values()].filter(s => s >= 3).length

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
      dueReviews={dueCount ?? 0}
      fluentTopics={fluentTopics}
      explanationCount={explainCount ?? 0}
    />
  )
}
