'use client'

import { useState, useEffect, useMemo } from 'react'
import { CalendarDays, Loader2, X } from 'lucide-react'
import { format, addDays, startOfWeek, isSameWeek } from 'date-fns'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import type { ShiftType } from '@/types/database'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
}

// Default study windows applied when a day is first switched to a shift.
const SHIFT_WINDOWS: Record<ShiftType, { start: string; end: string }> = {
  A: { start: '13:00', end: '17:00' },
  B: { start: '07:00', end: '11:00' },
}

// How many days ahead the roster covers (starting today).
const DAYS_AHEAD = 28

type DayState = ShiftType | 'off'
interface DayConfig {
  state: DayState
  start: string
  end: string
}

const OFF_DEFAULT: DayConfig = { state: 'off', start: SHIFT_WINDOWS.A.start, end: SHIFT_WINDOWS.A.end }
const hhmm = (t: string) => t.slice(0, 5)

export function ShiftConfigDialog({ open, onOpenChange }: Props) {
  const [loading, setLoading] = useState(true)
  const [configs, setConfigs] = useState<Record<string, DayConfig>>({})
  const [pending, setPending] = useState<Record<string, boolean>>({})

  const days = useMemo(
    () => Array.from({ length: DAYS_AHEAD }, (_, i) => addDays(new Date(), i)),
    [],
  )
  const todayStr = format(days[0], 'yyyy-MM-dd')
  const tomorrowStr = format(days[1], 'yyyy-MM-dd')
  const rangeFrom = todayStr
  const rangeTo = format(days[days.length - 1], 'yyyy-MM-dd')

  useEffect(() => {
    if (!open) return
    async function load() {
      setLoading(true)
      const supabase = createClient()
      const { data } = await supabase
        .from('shifts')
        .select('date,type,study_start,study_end')
        .gte('date', rangeFrom)
        .lte('date', rangeTo)
      const next: Record<string, DayConfig> = {}
      for (const s of data ?? []) {
        next[s.date] = {
          state: s.type as ShiftType,
          start: s.study_start ? hhmm(s.study_start) : SHIFT_WINDOWS[s.type as ShiftType].start,
          end: s.study_end ? hhmm(s.study_end) : SHIFT_WINDOWS[s.type as ShiftType].end,
        }
      }
      setConfigs(next)
      setLoading(false)
    }
    load()
  }, [open, rangeFrom, rangeTo])

  const configFor = (dateStr: string) => configs[dateStr] ?? OFF_DEFAULT

  async function persist(dateStr: string, cfg: DayConfig) {
    setPending(p => ({ ...p, [dateStr]: true }))
    const supabase = createClient()
    const { error } = cfg.state === 'off'
      ? await supabase.from('shifts').delete().eq('date', dateStr)
      : await supabase.from('shifts').upsert(
          { date: dateStr, type: cfg.state, study_start: cfg.start, study_end: cfg.end },
          { onConflict: 'date' },
        )
    setPending(p => ({ ...p, [dateStr]: false }))
    if (error) toast.error('Could not update shift')
    return !error
  }

  async function setState(dateStr: string, next: DayState) {
    const prev = configFor(dateStr)
    if (prev.state === next) return
    // When switching on from "off", seed that shift's default window.
    const cfg: DayConfig = next === 'off'
      ? { ...prev, state: 'off' }
      : prev.state === 'off'
        ? { state: next, ...SHIFT_WINDOWS[next] }
        : { ...prev, state: next }

    setConfigs(c => ({ ...c, [dateStr]: cfg }))
    const ok = await persist(dateStr, cfg)
    if (!ok) setConfigs(c => ({ ...c, [dateStr]: prev })) // roll back
  }

  // Live edit of the time inputs (local only — persisted on blur).
  function editTime(dateStr: string, field: 'start' | 'end', value: string) {
    setConfigs(c => ({ ...c, [dateStr]: { ...configFor(dateStr), [field]: value } }))
  }

  async function commitTime(dateStr: string) {
    const cfg = configFor(dateStr)
    if (cfg.state === 'off') return
    if (cfg.end <= cfg.start) { toast.error('End time must be after start'); return }
    await persist(dateStr, cfg)
  }

  function renderDay(day: Date) {
    const dateStr = format(day, 'yyyy-MM-dd')
    const cfg = configFor(dateStr)
    const isPending = pending[dateStr]
    const badge = dateStr === todayStr ? 'Today' : dateStr === tomorrowStr ? 'Tomorrow' : null

    return (
      <div key={dateStr}>
        <div className="flex items-center gap-3">
          <div className="w-14 flex-shrink-0">
            <div className="flex items-center gap-1.5">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300 leading-tight">{format(day, 'EEE')}</p>
              {badge && <span className="w-1.5 h-1.5 rounded-full bg-brand-500" aria-hidden="true" />}
            </div>
            <p className="text-xs text-gray-400 tabular-nums">{format(day, 'MMM d')}</p>
          </div>
          <div className="flex-1 flex gap-1.5">
            {(['A', 'B', 'off'] as const).map(opt => {
              const active = cfg.state === opt
              return (
                <button
                  key={opt}
                  type="button"
                  disabled={isPending}
                  onClick={() => setState(dateStr, opt)}
                  className={cn(
                    'flex-1 py-2 text-xs font-medium rounded-lg border transition-all disabled:opacity-60',
                    active
                      ? opt === 'A'
                        ? 'bg-brand-600 text-white border-brand-600'
                        : opt === 'B'
                          ? 'bg-teal-600 text-white border-teal-600'
                          : 'bg-gray-200 dark:bg-[#30363D] text-gray-600 dark:text-gray-300 border-gray-200 dark:border-[#30363D]'
                      : 'border-gray-200 dark:border-[#30363D] text-gray-500 hover:border-gray-300 dark:hover:border-gray-600',
                  )}
                >
                  {opt === 'off' ? 'Off' : `Shift ${opt}`}
                </button>
              )
            })}
          </div>
          {isPending && <Loader2 size={13} className="animate-spin text-gray-300 flex-shrink-0" />}
        </div>

        {/* Study window — only when a shift is set */}
        {cfg.state !== 'off' && (
          <div className="flex items-center gap-2 mt-2 ml-[68px]">
            <span className="text-[11px] text-gray-400">Study</span>
            <input
              type="time"
              value={cfg.start}
              disabled={isPending}
              onChange={e => editTime(dateStr, 'start', e.target.value)}
              onBlur={() => commitTime(dateStr)}
              className="px-2 py-1 text-xs tabular-nums border border-gray-200 dark:border-[#30363D] dark:bg-[#1C2128] dark:text-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-400/30 focus:border-brand-400"
            />
            <span className="text-[11px] text-gray-400">–</span>
            <input
              type="time"
              value={cfg.end}
              disabled={isPending}
              onChange={e => editTime(dateStr, 'end', e.target.value)}
              onBlur={() => commitTime(dateStr)}
              className="px-2 py-1 text-xs tabular-nums border border-gray-200 dark:border-[#30363D] dark:bg-[#1C2128] dark:text-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-400/30 focus:border-brand-400"
            />
          </div>
        )}
      </div>
    )
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => onOpenChange(false)}>
      <div className="absolute inset-0 bg-black/40" />
      <div
        className="relative w-full max-w-md bg-white dark:bg-[#161B22] border border-gray-200 dark:border-[#30363D] rounded-2xl shadow-xl flex flex-col max-h-[85dvh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-3 border-b border-gray-100 dark:border-[#21262D]">
          <div className="flex items-center gap-2">
            <CalendarDays size={16} className="text-brand-500" />
            <div>
              <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Shift schedule</h2>
              <p className="text-xs text-gray-400 mt-0.5">Set each day&apos;s shift and the hours you can study.</p>
            </div>
          </div>
          <button onClick={() => onOpenChange(false)} className="text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0">
            <X size={16} />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="px-5 py-5 overflow-y-auto">
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-11 bg-gray-100 dark:bg-[#1C2128] rounded-lg animate-pulse" />
              ))}
            </div>
          ) : (
            <>
              {/* Quick config — today & tomorrow */}
              <div className="rounded-xl border border-brand-100 dark:border-brand-900/40 bg-brand-50/50 dark:bg-brand-900/10 p-4 space-y-4 mb-6">
                <p className="text-[10px] font-medium text-brand-700 dark:text-brand-400 uppercase tracking-wider">Next up</p>
                {renderDay(days[0])}
                {renderDay(days[1])}
              </div>

              {/* Rest of the roster, grouped by week */}
              <div className="space-y-4">
                {days.slice(2).map((day, i, arr) => {
                  const newWeek = i === 0 || !isSameWeek(day, arr[i - 1], { weekStartsOn: 1 })
                  return (
                    <div key={format(day, 'yyyy-MM-dd')}>
                      {newWeek && (
                        <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-2 mt-1">
                          Week of {format(startOfWeek(day, { weekStartsOn: 1 }), 'MMM d')}
                        </p>
                      )}
                      {renderDay(day)}
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
