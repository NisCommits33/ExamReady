'use client'

import { useState } from 'react'
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'
import { format, addDays, parseISO, startOfWeek, endOfWeek, isSameDay, isToday } from 'date-fns'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { SESSION_TYPE_COLORS } from '@/lib/constants'
import type { PlannedSession, Shift } from '@/types/database'

interface TimetableClientProps {
  initialPlanned: PlannedSession[]
  shifts: Shift[]
  sessions: { date: string; duration_mins: number; topics: { name: string } | null }[]
  weekStartDate: string
}

export function TimetableClient({ initialPlanned, shifts, sessions, weekStartDate }: TimetableClientProps) {
  const [planned, setPlanned] = useState<PlannedSession[]>(initialPlanned)
  const [weekStart, setWeekStart] = useState(parseISO(weekStartDate))
  const [replanning, setReplanning] = useState(false)

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const shiftsMap = Object.fromEntries(shifts.map(s => [s.date, s]))
  const sessionsByDay = sessions.reduce<Record<string, typeof sessions>>((acc, s) => {
    const d = s.date
    if (!acc[d]) acc[d] = []
    acc[d].push(s)
    return acc
  }, {})

  async function toggleComplete(id: string, completed: boolean) {
    const supabase = createClient()
    await supabase.from('planned_sessions').update({ completed }).eq('id', id)
    setPlanned(prev => prev.map(p => p.id === id ? { ...p, completed } : p))
  }

  async function replan() {
    setReplanning(true)
    try {
      await fetch('/api/ai/replan-schedule', { method: 'POST' })
      toast.success('Schedule updated — refresh to see changes')
    } catch {
      toast.error('Replan failed')
    } finally {
      setReplanning(false)
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-lg font-medium text-gray-900 dark:text-gray-100">Timetable</h1>
        <div className="flex items-center gap-2">
          <button onClick={() => setWeekStart(d => addDays(d, -7))} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-[#1C2128] text-gray-500 dark:text-gray-400 transition-colors">
            <ChevronLeft size={18} />
          </button>
          <span className="text-sm text-gray-600 dark:text-gray-400 w-32 text-center">
            {format(weekStart, 'MMM d')} – {format(addDays(weekStart, 6), 'MMM d')}
          </span>
          <button onClick={() => setWeekStart(d => addDays(d, 7))} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-[#1C2128] text-gray-500 dark:text-gray-400 transition-colors">
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      {/* Days */}
      <div className="space-y-3">
        {days.map(day => {
          const dateStr = format(day, 'yyyy-MM-dd')
          const shift = shiftsMap[dateStr]
          const dayPlanned = planned.filter(p => p.scheduled_date === dateStr)
          const dayDone = sessionsByDay[dateStr] ?? []
          const todayDay = isToday(day)
          const past = day < new Date() && !todayDay

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

              {/* Sessions */}
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
                      <div key={s.id} className="flex items-center gap-3">
                        <button
                          onClick={() => toggleComplete(s.id, !s.completed)}
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
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>

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
    </div>
  )
}
