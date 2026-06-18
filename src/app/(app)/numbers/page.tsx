import { createClient } from '@/lib/supabase/server'
import { NumbersClient } from '@/components/numbers/NumbersClient'

export default async function NumbersPage() {
  const supabase = await createClient()

  const [{ data: numbers }, { data: topics }, { data: notes }] = await Promise.all([
    supabase.from('key_numbers').select('*,topics(name)').order('created_at'),
    supabase.from('topics').select('id,name').order('paper').order('topic_number'),
    supabase.from('topic_notes').select('topic_id').not('key_points', 'is', null),
  ])

  const topicsWithNotes = new Set((notes ?? []).map(n => n.topic_id))
  const extractable = (topics ?? []).filter(t => topicsWithNotes.has(t.id))

  return <NumbersClient initialNumbers={numbers ?? []} extractableTopics={extractable} />
}
