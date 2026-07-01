import { createClient } from '@/lib/supabase/server'
import { format } from 'date-fns'
import { ReviewClient } from '@/components/review/ReviewClient'

export const dynamic = 'force-dynamic'

export default async function ReviewPage() {
  const supabase = await createClient()
  const today = format(new Date(), 'yyyy-MM-dd')

  const { data: due } = await supabase
    .from('flashcard_reviews')
    .select('card_key,topic_id,front,back,ease,ef,reps,lapses,interval_days,due_date,source,topics(name)')
    .lte('due_date', today)
    .order('due_date', { ascending: true })
    .limit(300)

  const cards = (due ?? []).map(r => ({
    card_key: r.card_key,
    topic_id: r.topic_id,
    front: r.front,
    back: r.back,
    ease: r.ease,
    ef: r.ef ?? 2.5,
    reps: r.reps ?? 0,
    lapses: r.lapses ?? 0,
    interval_days: r.interval_days ?? 0,
    due_date: r.due_date,
    source: r.source,
    topic_name: (Array.isArray(r.topics) ? r.topics[0] : r.topics)?.name ?? null,
  }))

  return <ReviewClient initialCards={cards} />
}
