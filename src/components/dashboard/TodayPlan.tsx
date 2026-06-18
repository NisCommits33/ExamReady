'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Check, Plus } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { SESSION_TYPE_COLORS } from '@/lib/constants'
import type { PlannedSession } from '@/types/database'

interface TodayPlanProps {
  sessions: PlannedSession[]
  onLogSession: () => void
}

export function TodayPlan({ sessions, onLogSession }: TodayPlanProps) {
  const [completed, setCompleted] = useState<Record<string, boolean>>(
    Object.fromEntries(sessions.map(s => [s.id, s.completed]))
  )

  async function toggle(id: string) {
    const next = !completed[id]
    setCompleted(prev => ({ ...prev, [id]: next }))
    const supabase = createClient()
    await supabase.from('planned_sessions').update({ completed: next }).eq('id', id)
  }

  return (
    <div className="bg-white dark:bg-[#161B22] border border-gray-200 dark:border-[#30363D] rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-medium text-gray-900 dark:text-gray-100">Today's plan</h2>
        <Link href="/timetable" className="text-xs text-brand-600 hover:text-brand-800 dark:hover:text-brand-400 transition-colors">Edit</Link>
      </div>

      {sessions.length === 0 ? (
        <div className="py-6 text-center">
          <p className="text-sm text-gray-400 dark:text-gray-500">No sessions planned for today</p>
          <p className="text-xs text-gray-300 dark:text-gray-600 mt-1">AI will generate a plan after you set up topics</p>
        </div>
      ) : (
        <div className="space-y-2">
          {sessions.map(s => {
            const done = completed[s.id]
            const typeConfig = SESSION_TYPE_COLORS[s.session_type]
            const topicName = (s.topics as { name: string } | null)?.name ?? 'IQ Practice'
            return (
              <div
                key={s.id}
                className={cn(
                  'flex items-center gap-3 py-2.5 px-3 rounded-lg transition-all duration-200',
                  done ? 'bg-success-50' : 'bg-gray-50 dark:bg-[#1C2128]'
                )}
              >
                <button
                  onClick={() => toggle(s.id)}
                  className={cn(
                    'flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-all duration-200',
                    done ? 'bg-success-400 border-success-400' : 'border-gray-300 dark:border-gray-600 hover:border-brand-400'
                  )}
                >
                  {done && <Check size={12} strokeWidth={2.5} className="text-white" />}
                </button>
                <div className={cn('flex-shrink-0 w-1 h-8 rounded-full', typeConfig.bar)} />
                <div className="flex-1 min-w-0">
                  <p className={cn('text-sm font-medium truncate', done ? 'text-gray-400 line-through' : 'text-gray-800 dark:text-gray-200')}>
                    {topicName}
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500">
                    {typeConfig.label} · {s.duration_mins}m{s.slot_time ? ` · ${s.slot_time}` : ''}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <button
        onClick={onLogSession}
        className="mt-3 w-full flex items-center justify-center gap-1.5 py-2 text-sm text-gray-500 dark:text-gray-400 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg hover:border-brand-400 hover:text-brand-600 dark:hover:border-brand-700 dark:hover:text-brand-400 transition-all duration-150"
      >
        <Plus size={14} /> Log a session
      </button>
    </div>
  )
}
