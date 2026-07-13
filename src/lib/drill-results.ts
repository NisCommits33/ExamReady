import { createClient } from '@/lib/supabase/client'
import { gradeTopicFromScore } from '@/lib/review-cards'
import { recordStudyEvent } from '@/lib/study-events'
import type { DrillSection } from '@/types/database'

export async function saveDrillResult(params: {
  section: DrillSection
  topicId?: string | null
  subtopicId?: string | null
  topicName?: string | null
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
    void recordStudyEvent({
      topicId: params.topicId ?? null,
      subtopicId: params.subtopicId ?? null,
      eventType: 'practice',
      source: 'practice',
      metadata: {
        section: params.section,
        correct: params.score,
        total: params.total,
        scorePct: params.total > 0 ? Math.round((params.score / params.total) * 100) : null,
      },
    })
    // A topic drill grades that topic's spaced-repetition card by how well it went.
    if (params.topicId && params.topicName && params.total > 0) {
      await gradeTopicFromScore(params.topicId, params.topicName, Math.round((params.score / params.total) * 100))
    }
  } catch {}
}
