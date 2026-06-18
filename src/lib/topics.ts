import type { Topic, TopicStatus } from '@/types/database'

/** Select string that joins each topic to the current user's progress row (RLS-scoped). */
export const TOPIC_WITH_PROGRESS = '*, user_topic_progress(status,last_studied,is_flagged,mcq_best_score)'

interface RawTopic {
  user_topic_progress?: { status?: TopicStatus; last_studied?: string | null; is_flagged?: boolean; mcq_best_score?: number | null }[] | { status?: TopicStatus; last_studied?: string | null; is_flagged?: boolean; mcq_best_score?: number | null } | null
  [k: string]: unknown
}

/** Merge the nested per-user progress into flat Topic fields the app expects. */
export function flattenTopic(row: RawTopic): Topic {
  const raw = row.user_topic_progress
  const p = (Array.isArray(raw) ? raw[0] : raw) ?? null
  const { user_topic_progress: _omit, ...rest } = row
  return {
    ...(rest as unknown as Topic),
    status: p?.status ?? 'not_started',
    last_studied: p?.last_studied ?? null,
    is_flagged: p?.is_flagged ?? false,
    mcq_best_score: p?.mcq_best_score ?? null,
  }
}

export function flattenTopics(rows: RawTopic[] | null | undefined): Topic[] {
  return (rows ?? []).map(flattenTopic)
}
