import { createClient } from '@/lib/supabase/client'
import type { DrillSection } from '@/types/database'

export async function saveDrillResult(params: {
  section: DrillSection
  topicId?: string | null
  subtopicId?: string | null
  score: number
  total: number
}) {
  try {
    const supabase = createClient()
    await supabase.from('drill_results').insert({
      section: params.section,
      topic_id: params.topicId ?? null,
      subtopic_id: params.subtopicId ?? null,
      score: params.score,
      total: params.total,
    })
  } catch {}
}
