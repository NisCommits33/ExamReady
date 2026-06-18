// Lightweight SM-2-style spaced repetition scheduling.

// Interval ladder (in days) indexed by ease level.
const INTERVALS = [1, 2, 4, 8, 16, 30, 60]

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

export function nextOnKnown(ease: number): { ease: number; interval_days: number; due_date: string } {
  const newEase = Math.min(ease + 1, INTERVALS.length - 1)
  const interval = INTERVALS[newEase]
  return { ease: newEase, interval_days: interval, due_date: addDays(interval) }
}

export function nextOnReview(): { ease: number; interval_days: number; due_date: string } {
  return { ease: 0, interval_days: 0, due_date: todayStr() }
}

/** A card is due if it has never been reviewed or its due date is today/past. */
export function isDue(dueDate: string | null | undefined): boolean {
  if (!dueDate) return true
  return dueDate <= todayStr()
}
