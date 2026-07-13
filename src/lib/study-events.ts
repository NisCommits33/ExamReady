import { createClient } from '@/lib/supabase/client'
import type { StudyEventSource, StudyEventType } from '@/types/database'

export interface StudyEventInput {
  topicId?: string | null
  subtopicId?: string | null
  eventType: StudyEventType
  source: StudyEventSource
  startedAt?: string
  endedAt?: string | null
  durationS?: number
  metadata?: Record<string, unknown>
}

export async function recordStudyEvent(input: StudyEventInput): Promise<boolean> {
  try {
    const duration = Math.max(0, Math.round(input.durationS ?? 0))
    const startedAt = input.startedAt ?? new Date().toISOString()
    const endedAt = input.endedAt ?? (duration > 0 ? new Date(new Date(startedAt).getTime() + duration * 1000).toISOString() : null)
    const supabase = createClient()
    const { error } = await supabase.from('study_events').insert({
      topic_id: input.topicId ?? null,
      subtopic_id: input.subtopicId ?? null,
      event_type: input.eventType,
      source: input.source,
      started_at: startedAt,
      ended_at: endedAt,
      duration_s: duration,
      metadata: input.metadata ?? {},
    })
    if (error) {
      console.error('recordStudyEvent failed', error)
      return false
    }
    return true
  } catch (error) {
    console.error('recordStudyEvent failed', error)
    return false
  }
}
