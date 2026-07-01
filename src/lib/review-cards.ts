// Shared entry point for creating/updating spaced-repetition review cards.
//
// Every learning feature (flashcards, active recall, Feynman gaps, recall-by-doing, drills)
// funnels through here so they all land in one `flashcard_reviews` queue scored by the same
// graded SM-2 engine. Runs client-side.

import { createClient } from '@/lib/supabase/client'
import { cardKey, schedule, type Grade, type ReviewCardSchedule } from '@/lib/spaced-repetition'

export type CardSource = 'keypoint' | 'feynman_gap' | 'recall_miss' | 'drill'

// The `flashcard_reviews` unique key is (user_id, card_key); user_id is filled by the column
// default (auth.uid()). The conflict target MUST list both columns or Postgres rejects the upsert.
export const REVIEW_CONFLICT = 'user_id,card_key'

interface CardMeta {
  card_key: string
  topic_id: string | null
  front: string
  back: string
  source: CardSource | null
}

/** Single source of truth for the `flashcard_reviews` row shape. */
export function reviewRow(meta: CardMeta, s: ReviewCardSchedule) {
  return {
    card_key: meta.card_key,
    topic_id: meta.topic_id,
    front: meta.front,
    back: meta.back,
    source: meta.source,
    ease: s.ease,
    ef: s.ef,
    reps: s.reps,
    lapses: s.lapses,
    interval_days: s.interval_days,
    due_date: s.due_date,
    last_reviewed: new Date().toISOString(),
  }
}

interface UpsertArgs {
  topicId: string | null
  front: string
  back: string
  grade: Grade
  source: CardSource
  /** Override the derived card key (e.g. topic-level cards keyed `t_{topicId}`). */
  key?: string
}

/**
 * Grade a review card, creating it if it doesn't exist. Reads the card's prior SM-2 state so the
 * interval grows correctly across sessions, then upserts the new schedule. Returns true on success.
 */
export async function upsertReviewCard({ topicId, front, back, grade, source, key }: UpsertArgs): Promise<boolean> {
  const supabase = createClient()
  const card_key = key ?? cardKey(topicId, back)

  const { data: prev } = await supabase
    .from('flashcard_reviews')
    .select('ef,reps,lapses,interval_days,ease')
    .eq('card_key', card_key)
    .maybeSingle()

  const s = schedule(grade, prev ?? {})
  const { error } = await supabase
    .from('flashcard_reviews')
    .upsert(reviewRow({ card_key, topic_id: topicId, front, back, source }, s), { onConflict: REVIEW_CONFLICT })

  if (error) { console.error('upsertReviewCard failed', error); return false }
  return true
}

/**
 * Convenience: turn a list of missed/weak points into `again`-graded cards so they resurface soon.
 * New cards get a deterministic `again` schedule, so we skip the per-card read and batch one upsert.
 * Used by recall-check and Feynman-gap flows.
 */
export async function seedWeakCards(topicId: string | null, points: string[], source: CardSource): Promise<boolean> {
  const rows = points
    .map(p => p.trim())
    .filter(text => text.length >= 6)
    .map(text => reviewRow(
      {
        card_key: cardKey(topicId, text),
        topic_id: topicId,
        front: `Recall: ${text.slice(0, 60)}${text.length > 60 ? '…' : ''}`,
        back: text,
        source,
      },
      schedule('again', {}),
    ))
  if (rows.length === 0) return true

  const supabase = createClient()
  const { error } = await supabase.from('flashcard_reviews').upsert(rows, { onConflict: REVIEW_CONFLICT })
  if (error) { console.error('seedWeakCards failed', error); return false }
  return true
}

/** Grade a topic-level review card from a drill/quiz percentage (0-100). */
export async function gradeTopicFromScore(topicId: string, topicName: string, pct: number): Promise<boolean> {
  const grade: Grade = pct < 50 ? 'again' : pct < 70 ? 'hard' : pct < 90 ? 'good' : 'easy'
  return upsertReviewCard({
    topicId,
    key: `t_${topicId}`,
    front: `Review topic: ${topicName}`,
    back: topicName,
    grade,
    source: 'drill',
  })
}
