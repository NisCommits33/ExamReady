// Graded SM-2-style spaced repetition scheduling.
//
// Two APIs live here:
//  - schedule(grade, prev): the graded 4-button engine (again/hard/good/easy) that tracks an
//    ease factor (EF) + rep count. This is the backbone every learning feature writes into.
//  - nextOnKnown/nextOnReview: thin legacy wrappers kept so the original two-button flashcard
//    UI keeps working while it migrates to grades.

// Interval ladder (in days) indexed by ease level — used by the legacy wrappers.
const INTERVALS = [1, 2, 4, 8, 16, 30, 60]

const MIN_EF = 1.3
const DEFAULT_EF = 2.5

export type Grade = 'again' | 'hard' | 'good' | 'easy'

export interface ReviewCardSchedule {
  ease: number          // legacy ladder index (kept in sync for back-compat)
  ef: number            // SM-2 ease factor
  reps: number          // consecutive successful reps
  lapses: number        // times the card was failed
  interval_days: number
  due_date: string
}

export interface PrevSchedule {
  ef?: number | null
  reps?: number | null
  lapses?: number | null
  interval_days?: number | null
  ease?: number | null
}

export function cardKey(topicId: string | null, back: string): string {
  const base = `${topicId ?? 'x'}:${back}`
  let hash = 0
  for (let i = 0; i < base.length; i++) {
    hash = (hash << 5) - hash + base.charCodeAt(i)
    hash |= 0
  }
  return `c_${Math.abs(hash).toString(36)}`
}

function todayStr(): string {
  return new Date().toISOString().split('T')[0]
}

function addDays(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

// Map a grade to the SM-2 quality score (0-5).
const GRADE_Q: Record<Grade, number> = { again: 1, hard: 3, good: 4, easy: 5 }

/**
 * Graded SM-2 scheduler. Given a grade and the card's previous state, returns its next state.
 * A failure (`again`) resets reps to 0 and re-queues the card for today; successes grow the
 * interval by the ease factor. The `ease` ladder index is kept roughly in sync for back-compat.
 */
export function schedule(grade: Grade, prev: PrevSchedule = {}): ReviewCardSchedule {
  const q = GRADE_Q[grade]
  let ef = prev.ef ?? DEFAULT_EF
  let reps = prev.reps ?? 0
  let lapses = prev.lapses ?? 0
  const prevInterval = prev.interval_days ?? 0

  // Standard SM-2 EF update.
  ef = ef + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
  if (ef < MIN_EF) ef = MIN_EF

  let interval: number
  if (grade === 'again') {
    reps = 0
    lapses += 1
    interval = 0 // relearn today
  } else {
    reps += 1
    if (reps === 1) interval = grade === 'easy' ? 3 : 1
    else if (reps === 2) interval = grade === 'easy' ? 6 : 3
    else interval = Math.round(Math.max(1, prevInterval) * ef)
    if (grade === 'hard') interval = Math.max(1, Math.round(interval * 0.6))
  }

  // Keep the legacy ladder index loosely aligned with the interval for the old UI.
  const ease = INTERVALS.reduce((best, v, i) => (v <= interval ? i : best), 0)

  return {
    ease,
    ef: Math.round(ef * 100) / 100,
    reps,
    lapses,
    interval_days: interval,
    due_date: interval <= 0 ? todayStr() : addDays(interval),
  }
}

// --- Legacy two-button wrappers (delegate to the graded engine) ---

export function nextOnKnown(ease: number): { ease: number; interval_days: number; due_date: string } {
  const s = schedule('good', { ease, reps: ease, interval_days: INTERVALS[Math.min(ease, INTERVALS.length - 1)] })
  return { ease: s.ease, interval_days: s.interval_days, due_date: s.due_date }
}

export function nextOnReview(): { ease: number; interval_days: number; due_date: string } {
  return { ease: 0, interval_days: 0, due_date: todayStr() }
}

/** A card is due if it has never been reviewed or its due date is today/past. */
export function isDue(dueDate: string | null | undefined): boolean {
  if (!dueDate) return true
  return dueDate <= todayStr()
}

/** Bucket a due date for queue ordering / display. */
export function dueBucket(dueDate: string | null | undefined): 'overdue' | 'today' | 'soon' {
  if (!dueDate) return 'today'
  const today = todayStr()
  if (dueDate < today) return 'overdue'
  if (dueDate === today) return 'today'
  return 'soon'
}
