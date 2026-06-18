import { createClient } from '@/lib/supabase/client'
import type { Subtopic } from '@/types/database'

/** Fetch a topic's subtopics ordered for display (client-side, RLS-scoped). */
export async function fetchSubtopics(topicId: string): Promise<Subtopic[]> {
  const supabase = createClient()
  const { data } = await supabase
    .from('subtopics')
    .select('*')
    .eq('topic_id', topicId)
    .order('sort_order')
  return (data ?? []) as Subtopic[]
}
