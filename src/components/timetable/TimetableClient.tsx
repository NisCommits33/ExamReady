'use client'

import { useState, useRef, useCallback } from 'react'
import { ChevronLeft, ChevronRight, Loader2, Plus, Check, Trash2 } from 'lucide-react'
import { format, addDays, parseISO, startOfWeek, endOfWeek, isSameDay, isToday } from 'date-fns'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { SESSION_TYPE_COLORS } from '@/lib/constants'
import { SessionPlanSheet } from '@/components/timetable/SessionPlanSheet'
import type { PlannedSession, Shift } from '@/types/database'

interface DoneSession {
  date: string
  duration_mins: number
  topics: { name: string } | null
}

interface TimetableClientProps {
  initialPlanned: PlannedSession[]
  shifts: Shift[]
  sessions: DoneSession[]
  weekStartDate: string
}

function SwipeableRow({ children, onDelete }: { children: React.ReactNode; onDelete: () => void }) {
  const [offsetX, setOffsetX] = useState(0)
  const swiping = useRef(false)
  const startX = useRef(0)

  return (
    <div className="relative overflow-hidden rounded-lg">
      <div className="absolute inset-y-0 right-0 w-20 bg-red-500 flex items-center justify-center">
        <Trash2 size={16} className="text-white" />
      </div>
      <div
        style={{ transform: `translateX(${offsetX}px)`, transition: swiping.current ? 'none' : 'transform 0.2s' }}
        className="relative bg-white dark:bg-[#161B22]"
        onTouchStart={e => { startX.current = e.touches[0].clientX; swiping.current = true }}
        onTouchMove={e => {
          const diff = e.touches[0].clientX - startX.current
          if (diff < 0) setOffsetX(Math.max(diff, -80))
        }}
        onTouchEnd={() => {
          swiping.current = false
          if (offsetX < -50) onDelete()
          setOffsetX(0)
        }}
      >
        {children}
      </div>
    </div>
  )
}

export function TimetableClient({ initialPlanned, shifts: initialShifts, sessions: initialSessions, weekStartDate }: TimetableClientProps) {
  const [planned, setPlanned] = useState<PlannedSession[]>(initialPlanned)
  const [shiftsData, setShiftsData] = useState<Shift[]>(initialShifts)
  const [sessionsData, setSessionsData] = useState<DoneSession[]>(initialSessions)
  const [weekStart, setWeekStart] = useState(parseISO(weekStartDate))
  const [replanning, setReplanning] = useState(false)
  const [loading, setLoading] = useState(false)

  const [sheetOpen, setSheetOpen] = useState(false)
  const [editingSession, setEditingSession] = useState<PlannedSession | null>(null)
  const [addForDate, setAddForDate] = useState<string | undefined>()

  const todayWeekStart = startOfWeek(new Date(), { weekStartsOn: 1 })
  const isCurrentWeek = isSameDay(weekStart, todayWeekStart)

  const fetchWeekData = useCallback(async (ws: Date) => {
    setLoading(true)
    const supabase = createClient()
    const from = format(ws, 'yyyy-MM-dd')
    const to = format(endOfWeek(ws, { weekStartsOn: 1 }), 'yyyy-MM-dd')

    const [{ data: p }, { data: sh }, { data: se }] = await Promise.all([
      supabase.from('planned_sessions').select('*,topics(name,paper,section)').gte('scheduled_date', from).lte('scheduled_date', to).order('scheduled_date').order('slot_time'),
      supabase.from('shifts').select('*,shift_types(study_start,study_end)').gte('date', from).lte('date', to),
      supabase.from('sessions').select('date,duration_mins,topics(name)').gte('date', from).lte('date', to),
    ])

    setPlanned(p ?? [])
    setShiftsData((sh ?? []).map(s => {
      const raw = (s as { shift_types?: unknown }).shift_types
      const st = (Array.isArray(raw) ? raw[0] : raw) as { study_start: string; study_end: string } | null
      const row = s as { study_start?: string | null; study_end?: string | null }
      return { ...s, study_start: row.study_start ?? st?.study_start ?? '', study_end: row.study_end ?? st?.study_end ?? '' }
    }) as Shift[])
    setSessionsData((se ?? []).map(s => ({
      date: s.date,
      duration_mins: s.duration_mins,
      topics: Array.isArray(s.topics) ? s.topics[0] ?? null : s.topics,
    })) as DoneSession[])
    setLoading(false)
  }, [])

  async function navigateWeek(direction: number) {
    const newStart = addDays(weekStart, direction * 7)
    setWeekStart(newStart)
    await fetchWeekData(newStart)
  }

  async function jumpToToday() {
    setWeekStart(todayWeekStart)
    await fetchWeekData(todayWeekStart)
  }

  async function toggleComplete(id: string, completed: boolean) {
    setPlanned(prev => prev.map(p => p.id === id ? { ...p, completed } : p))
    const supabase = createClient()
    await supabase.from('planned_sessions').update({ completed }).eq('id', id)
  }

  async function deleteSession(id: string) {
    setPlanned(prev => prev.filter(p => p.id !== id))
    const supabase = createClient()
    await supabase.from('planned_sessions').delete().eq('id', id)
    toast.success('Session removed')
  }

  async function replan() {
    setReplanning(true)
    try {
      const res = await fetch('/api/ai/replan-schedule', { method: 'POST' })
      const json = await res.json()
      if (json.ok) {
        await fetchWeekData(weekStart)
        toast.success(`Schedule updated — ${json.count} sessions planned`)
      } else {
        toast.error('Replan failed')
      }
    } catch {
      toast.error('Replan failed')
    } finally {
      setReplanning(false)
    }
  }

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const shiftsMap = Object.fromEntries(shiftsData.map(s => [s.date, s]))
  const sessionsByDay = sessionsData.reduce<Record<string, DoneSession[]>>((acc, s) => {
    if (!acc[s.date]) acc[s.date] = []
    acc[s.date].push(s)
    return acc
  }, {})

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-lg font-medium text-gray-900 dark:text-gray-100">Timetable</h1>
        <div className="flex items-center gap-2">
          <button onClick={() => navigateWeek(-1)} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-[#1C2128] text-gray-500 dark:text-gray-400 transition-colors">
            <ChevronLeft size={18} />
          </button>
          {!isCurrentWeek && (
            <button
              onClick={jumpToToday}
              className="text-[11px] font-semibold text-white bg-brand-600 px-2 py-0.5 rounded-full hover:bg-brand-800 transition-colors"
            >
              Today
            </button>
          )}
          <span className="text-sm text-gray-600 dark:text-gray-400 w-32 text-center">
            {format(weekStart, 'MMM d')} – {format(addDays(weekStart, 6), 'MMM d')}
          </span>
          <button onClick={() => navigateWeek(1)} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-[#1C2128] text-gray-500 dark:text-gray-400 transition-colors">
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 size={20} className="animate-spin text-gray-400" />
        </div>
      )}

      {/* Days */}
      {!loading && (
        <div className="space-y-3">
          {days.map(day => {
            const dateStr = format(day, 'yyyy-MM-dd')
            const shift = shiftsMap[dateStr]
            const dayPlanned = planned.filter(p => p.scheduled_date === dateStr)
            const dayDone = sessionsByDay[dateStr] ?? []
            const todayDay = isToday(day)
            const past = day < new Date() && !todayDay

            const totalCount = dayPlanned.length
            const completedCount = dayPlanned.filter(s => s.completed).length
            const totalMins = dayPlanned.reduce((sum, s) => sum + s.duration_mins, 0)

            return (
              <div
                key={dateStr}
                className={cn(
                  'rounded-xl border p-4 transition-colors',
                  todayDay ? 'bg-brand-50 border-brand-200' : past ? 'bg-gray-50 dark:bg-[#0D1117] border-gray-100 dark:border-[#21262D]' : 'bg-white dark:bg-[#161B22] border-gray-200 dark:border-[#30363D]'
                )}
              >
                {/* Day header */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <p className={cn('text-sm font-medium', todayDay ? 'text-brand-800' : past ? 'text-gray-400 dark:text-gray-600' : 'text-gray-900 dark:text-gray-100')}>
                      {format(day, 'EEE d')}
                    </p>
                    {todayDay && <span className="text-[10px] font-semibold text-white bg-brand-600 px-1.5 py-0.5 rounded-full">Today</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    {totalCount > 0 && (
                      <>
                        <span className="text-[11px] text-gray-400 dark:text-gray-500">
                          {completedCount}/{totalCount} done · {Math.round(totalMins / 60 * 10) / 10}h
                        </span>
                        <div className="w-16 h-1 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-success-400 rounded-full transition-all duration-300"
                            style={{ width: `${(completedCount / totalCount) * 100}%` }}
                          />
                        </div>
                      </>
                    )}
                    {shift && (
                      <span className={cn(
                        'text-[11px] font-medium px-2 py-0.5 rounded-full',
                        shift.type === 'A' ? 'bg-brand-50 text-brand-800' : 'bg-teal-50 text-teal-800'
                      )}>
                        Shift {shift.type}
                      </span>
                    )}
                    {shift && (
                      <span className="text-[11px] text-gray-400">
                        {shift.study_start.slice(0,5)}–{shift.study_end.slice(0,5)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Planned sessions */}
                {dayPlanned.length === 0 && dayDone.length === 0 ? (
                  <p className="text-xs text-gray-400 dark:text-gray-600 py-2 border border-dashed border-gray-200 dark:border-gray-700 rounded-lg text-center">
                    No sessions planned
                  </p>
                ) : (
                  <div className="space-y-2">
                    {dayPlanned.map(s => {
                      const typeConfig = SESSION_TYPE_COLORS[s.session_type]
                      const topicName = (s.topics as { name: string } | null)?.name ?? 'IQ Practice'
                      return (
                        <SwipeableRow key={s.id} onDelete={() => deleteSession(s.id)}>
                          <div
                            onClick={() => { setEditingSession(s); setAddForDate(undefined); setSheetOpen(true) }}
                            className="flex items-center gap-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-[#1C2128] -mx-1 px-1 rounded-lg transition-colors"
                          >
                            <button
                              onClick={e => { e.stopPropagation(); toggleComplete(s.id, !s.completed) }}
                              className={cn(
                                'flex-shrink-0 w-4 h-4 rounded border-2 transition-all duration-150',
                                s.completed ? 'bg-success-400 border-success-400' : 'border-gray-300 hover:border-brand-400'
                              )}
                            >
                              {s.completed && (
                                <svg viewBox="0 0 12 12" fill="none" className="w-full p-0.5">
                                  <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                              )}
                            </button>
                            <div className={cn('flex-shrink-0 w-1 h-7 rounded-full', typeConfig.bar)} />
                            <div className="flex-1 min-w-0">
                              <p className={cn('text-sm truncate', s.completed ? 'text-gray-400 line-through' : 'text-gray-800 dark:text-gray-200')}>{topicName}</p>
                              <p className="text-xs text-gray-400 dark:text-gray-500">{typeConfig.label} · {s.duration_mins}m{s.slot_time ? ` · ${s.slot_time}` : ''}</p>
                            </div>
                            {s.ai_generated && <span className="text-[10px] text-purple-400 flex-shrink-0">AI</span>}
                          </div>
                        </SwipeableRow>
                      )
                    })}
                  </div>
                )}

                {/* Logged sessions */}
                {dayDone.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-100 dark:border-[#21262D]">
                    <p className="text-[10px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">Logged</p>
                    {dayDone.map((s, i) => (
                      <div key={i} className="flex items-center gap-3 py-1.5">
                        <div className="flex-shrink-0 w-4 h-4 rounded bg-success-100 dark:bg-success-900/30 flex items-center justify-center">
                          <Check size={10} className="text-success-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{s.topics?.name ?? 'Session'}</p>
                          <p className="text-xs text-gray-300 dark:text-gray-600">{s.duration_mins}m</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add session button */}
                <button
                  onClick={() => { setAddForDate(dateStr); setEditingSession(null); setSheetOpen(true) }}
                  className="mt-2 w-full flex items-center justify-center gap-1.5 py-1.5 text-xs text-gray-400 border border-dashed border-gray-200 dark:border-gray-700 rounded-lg hover:border-brand-400 hover:text-brand-600 dark:hover:border-brand-700 dark:hover:text-brand-400 transition-all duration-150"
                >
                  <Plus size={12} /> Add session
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* Replan button */}
      <button
        onClick={replan}
        disabled={replanning}
        className="mt-5 w-full py-3 border border-gray-200 dark:border-[#30363D] bg-white dark:bg-[#161B22] text-sm font-medium text-gray-700 dark:text-gray-300 rounded-xl hover:border-purple-400 dark:hover:border-purple-700 hover:text-purple-800 dark:hover:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-all duration-150 flex items-center justify-center gap-2"
      >
        {replanning ? (
          <><Loader2 size={15} className="animate-spin" /> AI is replanning…</>
        ) : (
          <><span className="text-[11px] font-semibold bg-purple-50 text-purple-800 px-1.5 py-0.5 rounded-full">AI</span> Replan this week</>
        )}
      </button>

      {/* Session plan sheet */}
      <SessionPlanSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onSaved={() => fetchWeekData(weekStart)}
        editSession={editingSession}
        defaultDate={addForDate}
      />
    </div>
  )
}
