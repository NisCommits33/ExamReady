import {
  GRID_DEFAULT_START_HOUR,
  GRID_DEFAULT_END_HOUR,
  GRID_PX_PER_HOUR,
  GRID_SNAP_MIN,
} from '@/lib/constants'
import type { PlannedSession, Shift } from '@/types/database'

/** "HH:MM[:SS]" → minutes from midnight. Returns null for empty/invalid input. */
export function toMinutes(hhmm: string | null | undefined): number | null {
  if (!hhmm) return null
  const [h, m] = hhmm.split(':')
  const hours = Number(h)
  const mins = Number(m)
  if (Number.isNaN(hours) || Number.isNaN(mins)) return null
  return hours * 60 + mins
}

/** Minutes from midnight → "HH:MM" (24h, zero-padded). */
export function fromMinutes(total: number): string {
  const clamped = Math.max(0, Math.min(24 * 60 - 1, Math.round(total)))
  const h = Math.floor(clamped / 60)
  const m = clamped % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

// Resolve with fallbacks so a bad/undefined import can never yield NaN geometry.
const orDefault = (v: number, d: number) => (Number.isFinite(v) ? v : d)
const PX_PER_HOUR = orDefault(GRID_PX_PER_HOUR, 56)
const START_HOUR = orDefault(GRID_DEFAULT_START_HOUR, 6)
const END_HOUR = orDefault(GRID_DEFAULT_END_HOUR, 22)
const SNAP_MIN = orDefault(GRID_SNAP_MIN, 15)
const PX_PER_MIN = PX_PER_HOUR / 60

/**
 * Visible vertical range for a day's grid, in minutes from midnight, snapped to
 * whole hours. Starts from the default window and expands to include every
 * shift window and timed session so nothing is clipped.
 */
export function gridRange(
  shifts: Shift[],
  planned: PlannedSession[],
): { startMin: number; endMin: number } {
  let start = START_HOUR * 60
  let end = END_HOUR * 60

  const consider = (min: number | null, endMin?: number) => {
    if (min == null) return
    start = Math.min(start, min)
    end = Math.max(end, endMin ?? min)
  }

  for (const s of shifts) {
    consider(toMinutes(s.study_start))
    const e = toMinutes(s.study_end)
    if (e != null) end = Math.max(end, e)
  }
  for (const p of planned) {
    const m = toMinutes(p.slot_time)
    const dur = Number.isFinite(p.duration_mins) ? p.duration_mins : 0
    if (m != null) consider(m, m + dur)
  }

  // snap outward to whole hours
  start = Math.floor(start / 60) * 60
  end = Math.ceil(end / 60) * 60
  return { startMin: start, endMin: Math.max(end, start + 60) }
}

/** Pixels for a span of minutes at the grid's fixed scale. */
export function minutesToPx(mins: number): number {
  return mins * PX_PER_MIN
}

/** Total pixel height of the grid body for a given minute range. */
export function gridHeight(startMin: number, endMin: number): number {
  return (endMin - startMin) * PX_PER_MIN
}

/** Top offset (px) of a block that begins at `slotMin`, relative to the grid start. */
export function blockTop(slotMin: number, startMin: number): number {
  return (slotMin - startMin) * PX_PER_MIN
}

/** Height (px) of a block, floored so short sessions stay tappable. */
export function blockHeight(durationMins: number): number {
  return Math.max(durationMins * PX_PER_MIN, 22)
}

/** Snap a raw minute value to the nearest GRID_SNAP_MIN increment. */
export function snapMinutes(min: number): number {
  return Math.round(min / SNAP_MIN) * SNAP_MIN
}

/** Convert a pixel y-offset within the grid body to a snapped "HH:MM" slot time. */
export function yToSlot(y: number, startMin: number): string {
  return fromMinutes(snapMinutes(startMin + y / PX_PER_MIN))
}

export interface PositionedSession {
  session: PlannedSession
  startMin: number
  col: number
  cols: number
}

/**
 * Assign each timed session a column so overlapping sessions render side-by-side
 * (Google-Calendar style). Sessions are grouped into clusters of mutual overlap;
 * every session in a cluster shares the same `cols` count. Untimed sessions
 * (no slot_time) are excluded — the caller renders those separately.
 */
export function layoutOverlaps(planned: PlannedSession[]): PositionedSession[] {
  const timed = planned
    .map(session => ({ session, startMin: toMinutes(session.slot_time) }))
    .filter((x): x is { session: PlannedSession; startMin: number } => x.startMin != null)
    .sort((a, b) => a.startMin - b.startMin || a.session.duration_mins - b.session.duration_mins)

  const result: PositionedSession[] = []
  let cluster: { session: PlannedSession; startMin: number }[] = []
  let clusterEnd = -1

  const flush = () => {
    if (cluster.length === 0) return
    // greedily assign each session to the first column whose last block has ended
    const colEnds: number[] = []
    const assigned = cluster.map(item => {
      const end = item.startMin + item.session.duration_mins
      let col = colEnds.findIndex(e => e <= item.startMin)
      if (col === -1) { col = colEnds.length; colEnds.push(end) }
      else colEnds[col] = end
      return { ...item, col }
    })
    const cols = colEnds.length
    for (const a of assigned) result.push({ ...a, cols })
    cluster = []
    clusterEnd = -1
  }

  for (const item of timed) {
    if (cluster.length > 0 && item.startMin >= clusterEnd) flush()
    cluster.push(item)
    clusterEnd = Math.max(clusterEnd, item.startMin + item.session.duration_mins)
  }
  flush()

  return result
}
