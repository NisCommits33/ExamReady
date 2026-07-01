'use client'

import { useState, useCallback } from 'react'
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'
import { format, addDays, parseISO, startOfWeek, endOfWeek, isSameDay, isToday } from 'date-fns'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { SESSION_TYPE_COLORS } from '@/lib/constants'
import { SessionPlanSheet } from '@/components/timetable/SessionPlanSheet'
import { DayColumn } from '@/components/timetable/DayColumn'
import { gridRange, gridHeight, blockTop, fromMinutes } from '@/lib/timetable'
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

const HOURS_GUTTER_W = 'w-11'

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
  const [addForSlot, setAddForSlot] = useState<string | undefined>()

  const todayWeekStart = startOfWeek(new Date(), { weekStartsOn: 1 })
  const isCurrentWeek = isSameDay(weekStart, todayWeekStart)

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const todayIndex = days.findIndex(d => isToday(d))
  const [selectedDay, setSelectedDay] = useState(todayIndex >= 0 ? todayIndex : 0)

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
    setSelectedDay(0)
    await fetchWeekData(newStart)
  }

  async function jumpToToday() {
    setWeekStart(todayWeekStart)
    const idx = Array.from({ length: 7 }, (_, i) => addDays(todayWeekStart, i)).findIndex(d => isToday(d))
    setSelectedDay(idx >= 0 ? idx : 0)
    await fetchWeekData(todayWeekStart)
  }

  async function toggleComplete(id: string, completed: boolean) {
    setPlanned(prev => prev.map(p => p.id === id ? { ...p, completed } : p))
    const supabase = createClient()
    await supabase.from('planned_sessions').update({ completed }).eq('id', id)
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

  function openCreate(dateStr: string, slotTime: string) {
    setEditingSession(null)
    setAddForDate(dateStr)
    setAddForSlot(slotTime)
    setSheetOpen(true)
  }

  function openEdit(session: PlannedSession) {
    setEditingSession(session)
    setAddForDate(undefined)
    setAddForSlot(undefined)
    setSheetOpen(true)
  }

  const shiftsMap = Object.fromEntries(shiftsData.map(s => [s.date, s]))
  const plannedByDay = planned.reduce<Record<string, PlannedSession[]>>((acc, p) => {
    (acc[p.scheduled_date] ??= []).push(p)
    return acc
  }, {})
  const loggedMinsByDay = sessionsData.reduce<Record<string, number>>((acc, s) => {
    acc[s.date] = (acc[s.date] ?? 0) + s.duration_mins
    return acc
  }, {})

  const { startMin, endMin } = gridRange(shiftsData, planned)
  const bodyHeight = gridHeight(startMin, endMin)
  const now = new Date()
  const nowMin = now.getHours() * 60 + now.getMinutes()
  const hourMarks: number[] = []
  for (let m = startMin; m <= endMin; m += 60) hourMarks.push(m)

  // shared render helpers (plain functions, not components — avoids remount-per-render)

  function renderDayHeader(day: Date) {
    const dateStr = format(day, 'yyyy-MM-dd')
    const shift = shiftsMap[dateStr]
    const dayPlanned = plannedByDay[dateStr] ?? []
    const plannedMins = dayPlanned.reduce((s, x) => s + x.duration_mins, 0)
    const loggedMins = loggedMinsByDay[dateStr] ?? 0
    const today = isToday(day)
    return (
      <div className="px-1 py-1.5 text-center">
        <div className="flex items-center justify-center gap-1">
          <span className={cn('text-xs font-medium', today ? 'text-brand-800 dark:text-brand-300' : 'text-gray-600 dark:text-gray-300')}>
            {format(day, 'EEE d')}
          </span>
          {shift && (
            <span className={cn(
              'text-[9px] font-semibold px-1 rounded-full',
              shift.type === 'A' ? 'bg-brand-50 text-brand-800' : 'bg-teal-50 text-teal-800',
            )}>
              {shift.type}
            </span>
          )}
        </div>
        {(plannedMins > 0 || loggedMins > 0) && (
          <span className="text-[10px] text-gray-400 dark:text-gray-500">
            {Math.round(plannedMins / 6) / 10}h{loggedMins > 0 && ` · ${Math.round(loggedMins / 6) / 10}h done`}
          </span>
        )}
      </div>
    )
  }

  function renderUnscheduled(day: Date) {
    const dateStr = format(day, 'yyyy-MM-dd')
    const untimed = (plannedByDay[dateStr] ?? []).filter(p => !p.slot_time)
    if (untimed.length === 0) return null
    return (
      <div className="flex flex-wrap gap-1 px-1 pb-1">
        {untimed.map(s => {
          const type = SESSION_TYPE_COLORS[s.session_type]
          const topicName = (s.topics as { name: string } | null)?.name ?? 'IQ Practice'
          return (
            <button
              key={s.id}
              onClick={() => openEdit(s)}
              className={cn(
                'flex items-center gap-1 max-w-full rounded-full border border-dashed border-gray-300 dark:border-[#30363D] px-2 py-0.5 text-[10px]',
                s.completed ? 'text-gray-400 line-through' : 'text-gray-600 dark:text-gray-300',
              )}
            >
              <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', type.bar)} />
              <span className="truncate">{topicName}</span>
            </button>
          )
        })}
      </div>
    )
  }

  const renderHourGutter = () => (
    <div className={cn(HOURS_GUTTER_W, 'relative flex-shrink-0')} style={{ height: bodyHeight }}>
      {hourMarks.map(m => (
        <span
          key={m}
          className="absolute right-1 -translate-y-1/2 text-[10px] text-gray-400 dark:text-gray-500"
          style={{ top: blockTop(m, startMin) }}
        >
          {fromMinutes(m)}
        </span>
      ))}
    </div>
  )

  const selected = days[selectedDay] ?? days[0]

  return (
    <div>
      {/* Header + week nav */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-medium text-gray-900 dark:text-gray-100">Timetable</h1>
        <div className="flex items-center gap-2">
          <button onClick={() => navigateWeek(-1)} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-[#1C2128] text-gray-500 dark:text-gray-400 transition-colors">
            <ChevronLeft size={18} />
          </button>
          {!isCurrentWeek && (
            <button onClick={jumpToToday} className="text-[11px] font-semibold text-white bg-brand-600 px-2 py-0.5 rounded-full hover:bg-brand-800 transition-colors">
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

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={20} className="animate-spin text-gray-400" />
        </div>
      ) : (
        <>
          {/* ---- Desktop / tablet: full 7-day grid ---- */}
          <div className="hidden md:block rounded-xl border border-gray-200 dark:border-[#30363D] overflow-hidden">
            <div className="flex border-b border-gray-200 dark:border-[#30363D] bg-gray-50 dark:bg-[#0D1117]">
              <div className={cn(HOURS_GUTTER_W, 'flex-shrink-0')} />
              {days.map(day => (
                <div key={day.toISOString()} className="flex-1 border-l border-gray-200 dark:border-[#30363D]">
                  {renderDayHeader(day)}
                  {renderUnscheduled(day)}
                </div>
              ))}
            </div>
            <div className="flex overflow-y-auto max-h-[70dvh]">
              {renderHourGutter()}
              {days.map(day => {
                const dateStr = format(day, 'yyyy-MM-dd')
                return (
                  <div key={day.toISOString()} className="flex-1 border-l border-gray-200 dark:border-[#30363D]">
                    <DayColumn
                      dateStr={dateStr}
                      isToday={isToday(day)}
                      isPast={day < now && !isToday(day)}
                      shift={shiftsMap[dateStr]}
                      planned={(plannedByDay[dateStr] ?? []).filter(p => p.slot_time)}
                      startMin={startMin}
                      endMin={endMin}
                      nowMin={nowMin}
                      onCreate={openCreate}
                      onEdit={openEdit}
                      onToggleComplete={toggleComplete}
                    />
                  </div>
                )
              })}
            </div>
          </div>

          {/* ---- Mobile: day tabs + single day ---- */}
          <div className="md:hidden">
            <div className="flex gap-1 mb-3 overflow-x-auto">
              {days.map((day, i) => {
                const today = isToday(day)
                const active = i === selectedDay
                return (
                  <button
                    key={day.toISOString()}
                    onClick={() => setSelectedDay(i)}
                    className={cn(
                      'flex-1 min-w-[42px] py-1.5 rounded-lg text-center transition-colors',
                      active ? 'bg-brand-600 text-white' : today ? 'bg-brand-50 text-brand-800' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-[#1C2128]',
                    )}
                  >
                    <span className="block text-[10px] font-medium">{format(day, 'EEE')}</span>
                    <span className="block text-sm font-semibold">{format(day, 'd')}</span>
                  </button>
                )
              })}
            </div>

            <div className="rounded-xl border border-gray-200 dark:border-[#30363D] overflow-hidden">
              <div className="border-b border-gray-200 dark:border-[#30363D] bg-gray-50 dark:bg-[#0D1117]">
                {renderDayHeader(selected)}
                {renderUnscheduled(selected)}
              </div>
              <div className="flex overflow-y-auto max-h-[62dvh]">
                {renderHourGutter()}
                <div className="flex-1 border-l border-gray-200 dark:border-[#30363D]">
                  <DayColumn
                    dateStr={format(selected, 'yyyy-MM-dd')}
                    isToday={isToday(selected)}
                    isPast={selected < now && !isToday(selected)}
                    shift={shiftsMap[format(selected, 'yyyy-MM-dd')]}
                    planned={(plannedByDay[format(selected, 'yyyy-MM-dd')] ?? []).filter(p => p.slot_time)}
                    startMin={startMin}
                    endMin={endMin}
                    nowMin={nowMin}
                    onCreate={openCreate}
                    onEdit={openEdit}
                    onToggleComplete={toggleComplete}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Replan */}
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
        </>
      )}

      <SessionPlanSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onSaved={() => fetchWeekData(weekStart)}
        editSession={editingSession}
        defaultDate={addForDate}
        defaultSlot={addForSlot}
      />
    </div>
  )
}
