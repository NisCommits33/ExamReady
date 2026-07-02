import type { Topic, TopicStatus } from '@/types/database'

/**
 * Select string that joins each topic to the current user's progress row (RLS-scoped) plus its
 * subtopics. `subtopics` is the source of truth; `Topic.subsections` is derived from it (the old
 * denormalized `topics.subsections` column no longer exists).
 */
export const TOPIC_WITH_PROGRESS = '*, user_topic_progress(status,last_studied,is_flagged,mcq_best_score), subtopics(name,sort_order)'

interface RawTopic {
  user_topic_progress?: { status?: TopicStatus; last_studied?: string | null; is_flagged?: boolean; mcq_best_score?: number | null }[] | { status?: TopicStatus; last_studied?: string | null; is_flagged?: boolean; mcq_best_score?: number | null } | null
  subtopics?: { name: string; sort_order: number }[] | null
  [k: string]: unknown
}

/** Merge the nested per-user progress into flat Topic fields the app expects. */
export function flattenTopic(row: RawTopic): Topic {
  const raw = row.user_topic_progress
  const p = (Array.isArray(raw) ? raw[0] : raw) ?? null
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- destructure to drop nested joins from `rest`
  const { user_topic_progress: _omit, subtopics, ...rest } = row
  const subsections = [...(subtopics ?? [])].sort((a, b) => a.sort_order - b.sort_order).map(s => s.name)
  return {
    ...(rest as unknown as Topic),
    subsections,
    status: p?.status ?? 'not_started',
    last_studied: p?.last_studied ?? null,
    is_flagged: p?.is_flagged ?? false,
    mcq_best_score: p?.mcq_best_score ?? null,
  }
}

export function flattenTopics(rows: RawTopic[] | null | undefined): Topic[] {
  return (rows ?? []).map(flattenTopic)
}
