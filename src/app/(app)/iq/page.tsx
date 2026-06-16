import { createClient } from '@/lib/supabase/server'
import { IQClient } from '@/components/iq/IQClient'

export default async function IQPage() {
  const supabase = await createClient()

  const [{ data: stats }, { data: attempts }] = await Promise.all([
    supabase.from('iq_stats').select('*'),
    supabase.from('iq_attempts').select('is_correct,confidence,time_taken_s').order('attempted_at', { ascending: false }).limit(100),
  ])

  const totalAttempted = (stats ?? []).reduce((s, r) => s + r.total_attempted, 0)
  const avgAccuracy = stats?.length
    ? Math.round((stats ?? []).filter(s => s.total_attempted > 0).reduce((s, r) => s + r.accuracy_pct, 0) / Math.max(1, (stats ?? []).filter(s => s.total_attempted > 0).length))
    : 0
  const allTimes = (attempts ?? []).map(a => a.time_taken_s).filter(Boolean) as number[]
  const avgTime = allTimes.length ? Math.round(allTimes.reduce((a, b) => a + b, 0) / allTimes.length) : 0

  return (
    <IQClient
      stats={stats ?? []}
      totalAttempted={totalAttempted}
      avgAccuracy={avgAccuracy}
      avgTime={avgTime}
    />
  )
}
