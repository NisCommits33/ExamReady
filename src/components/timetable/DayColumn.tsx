'use client'

import { useRef } from 'react'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { SESSION_TYPE_COLORS } from '@/lib/constants'
import {
  blockTop,
  blockHeight,
  gridHeight,
  layoutOverlaps,
  minutesToPx,
  toMinutes,
  yToSlot,
} from '@/lib/timetable'
import type { PlannedSession, SessionType, Shift } from '@/types/database'

// Literal classes so Tailwind's scanner generates them (no runtime string building).
const BLOCK_STYLES: Record<SessionType, { border: string; bg: string }> = {
  study:  { border: 'border-l-brand-400',  bg: 'bg-brand-50 dark:bg-[#1C2128]'  },
  drill:  { border: 'border-l-purple-400', bg: 'bg-purple-50 dark:bg-[#1C2128]' },
  iq:     { border: 'border-l-teal-400',   bg: 'bg-teal-50 dark:bg-[#1C2128]'   },
  review: { border: 'border-l-gray-400',   bg: 'bg-gray-50 dark:bg-[#1C2128]'   },
}

interface DayColumnProps {
  dateStr: string
  isToday: boolean
  isPast: boolean
  shift?: Shift
  planned: PlannedSession[]
  startMin: number
  endMin: number
  nowMin: number
  onCreate: (dateStr: string, slotTime: string) => void
  onEdit: (session: PlannedSession) => void
  onToggleComplete: (id: string, completed: boolean) => void
}

export function DayColumn({
  dateStr,
  isToday,
  isPast,
  shift,
  planned,
  startMin,
  endMin,
  nowMin,
  onCreate,
  onEdit,
  onToggleComplete,
}: DayColumnProps) {
  const bodyRef = useRef<HTMLDivElement>(null)
  const height = gridHeight(startMin, endMin)
  const positioned = layoutOverlaps(planned)

  // whole-hour gridlines across the visible range
  const hours: number[] = []
  for (let m = startMin; m <= endMin; m += 60) hours.push(m)

  const shiftStart = toMinutes(shift?.study_start)
  const shiftEnd = toMinutes(shift?.study_end)
  const nowVisible = isToday && nowMin >= startMin && nowMin <= endMin

  function handleEmptyClick(e: React.MouseEvent<HTMLDivElement>) {
    const rect = bodyRef.current?.getBoundingClientRect()
    if (!rect) return
    onCreate(dateStr, yToSlot(e.clientY - rect.top, startMin))
  }

  return (
    <div
      ref={bodyRef}
      className={cn('relative w-full', isToday && 'bg-brand-50/40 dark:bg-brand-900/10', isPast && 'opacity-60')}
      style={{ height }}
    >
      {/* hour gridlines */}
      {hours.map(m => (
        <div
          key={m}
          className="absolute inset-x-0 border-t border-gray-100 dark:border-[#21262D]"
          style={{ top: blockTop(m, startMin) }}
        />
      ))}

      {/* shift / study window shade */}
      {shiftStart != null && shiftEnd != null && shiftEnd > shiftStart && (
        <div
          className={cn(
            'absolute inset-x-0.5 rounded-md pointer-events-none',
            shift?.type === 'A' ? 'bg-brand-500/10' : 'bg-teal-500/10',
          )}
          style={{ top: blockTop(shiftStart, startMin), height: minutesToPx(shiftEnd - shiftStart) }}
        />
      )}

      {/* click-to-create layer (behind blocks) */}
      <div className="absolute inset-0 cursor-copy" onClick={handleEmptyClick} />

      {/* current-time indicator */}
      {nowVisible && (
        <div className="absolute inset-x-0 z-20 pointer-events-none" style={{ top: blockTop(nowMin, startMin) }}>
          <div className="h-px bg-red-500" />
          <div className="absolute -left-1 -top-1 w-2 h-2 rounded-full bg-red-500" />
        </div>
      )}

      {/* session blocks */}
      {positioned.map(({ session, startMin: sMin, col, cols }) => {
        const type = SESSION_TYPE_COLORS[session.session_type]
        const style = BLOCK_STYLES[session.session_type]
        const topicName = (session.topics as { name: string } | null)?.name ?? 'IQ Practice'
        const top = blockTop(sMin, startMin)
        const h = blockHeight(session.duration_mins)
        const widthPct = 100 / cols
        return (
          <button
            key={session.id}
            onClick={() => onEdit(session)}
            className={cn(
              'absolute z-10 flex flex-col overflow-hidden rounded-md border-l-[3px] px-1.5 py-0.5 text-left shadow-sm transition-colors',
              style.border,
              session.completed ? 'bg-success-50 dark:bg-success-900/20' : style.bg,
            )}
            style={{ top, height: h, left: `calc(${col * widthPct}% + 1px)`, width: `calc(${widthPct}% - 2px)` }}
          >
            <span className="flex items-center gap-1">
              <span
                role="checkbox"
                aria-checked={session.completed}
                onClick={e => { e.stopPropagation(); onToggleComplete(session.id, !session.completed) }}
                className={cn(
                  'flex-shrink-0 w-3.5 h-3.5 rounded border flex items-center justify-center',
                  session.completed ? 'bg-success-400 border-success-400' : 'border-gray-300 dark:border-gray-500',
                )}
              >
                {session.completed && <Check size={9} className="text-white" strokeWidth={3} />}
              </span>
              <span
                className={cn(
                  'truncate text-[11px] font-medium leading-tight',
                  session.completed ? 'text-gray-400 line-through' : 'text-gray-800 dark:text-gray-200',
                )}
              >
                {topicName}
              </span>
              {session.ai_generated && <span className="ml-auto text-[9px] text-purple-400 flex-shrink-0">AI</span>}
            </span>
            {h >= 34 && (
              <span className="truncate text-[10px] text-gray-400 dark:text-gray-500 leading-tight pl-[18px]">
                {type.label} · {session.duration_mins}m
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
