'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ExamDateDialog } from '@/components/shared/ExamDateDialog'

interface CountdownCardProps {
  readiness: number
  sessionCount: number
  totalHours: number
}

function calcTimeLeft(examDate: string) {
  const diff = new Date(examDate + 'T00:00:00').getTime() - Date.now()
  const absDiff = Math.abs(diff)
  return {
    days: Math.floor(absDiff / (1000 * 60 * 60 * 24)),
    hours: Math.floor((absDiff / (1000 * 60 * 60)) % 24),
    minutes: Math.floor((absDiff / (1000 * 60)) % 60),
    seconds: Math.floor((absDiff / 1000) % 60),
    isPast: diff < 0,
  }
}

export function CountdownCard({ readiness, sessionCount, totalHours }: CountdownCardProps) {
  const [examDate, setExamDate] = useState<string | null>(null)
  const [timeLeft, setTimeLeft] = useState<ReturnType<typeof calcTimeLeft> | null>(null)
  const [dateOpen, setDateOpen] = useState(false)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data } = await supabase.from('user_settings').select('value').eq('key', 'exam_date').single()
      const date = data?.value ?? '2025-08-13'
      setExamDate(date)
      setTimeLeft(calcTimeLeft(date))
    }
    load()
  }, [])

  useEffect(() => {
    if (!examDate) return
    const interval = setInterval(() => setTimeLeft(calcTimeLeft(examDate)), 1000)
    return () => clearInterval(interval)
  }, [examDate])

  const days = timeLeft?.days ?? 0
  const radius = 15.9
  const circumference = 2 * Math.PI * radius
  const strokeDash = (readiness / 100) * circumference

  return (
    <>
    <button
      type="button"
      onClick={() => setDateOpen(true)}
      title="Set exam date"
      className="w-full text-left bg-brand-50 border border-brand-100 dark:border-brand-900/40 rounded-xl p-4 hover:border-brand-300 dark:hover:border-brand-700 transition-colors"
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-baseline gap-1.5">
            <span className="text-[64px] font-medium text-brand-800 leading-none tracking-tight" style={{ letterSpacing: '-0.03em' }}>
              {days}
            </span>
            <span className="text-xl text-brand-600 font-medium">days</span>
          </div>
          {timeLeft && (
            <p className="text-sm font-mono tabular-nums text-brand-600 mt-0.5">
              {String(timeLeft.hours).padStart(2, '0')}:{String(timeLeft.minutes).padStart(2, '0')}:{String(timeLeft.seconds).padStart(2, '0')}
            </p>
          )}
          <p className="text-xs text-brand-600 mt-1">
            {timeLeft?.isPast ? 'exam passed' : 'to exam'} · {examDate ? new Date(examDate).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }) : ''}
          </p>
          <div className="flex items-center gap-3 mt-3">
            <span className="text-xs text-brand-700"><strong className="font-semibold">{sessionCount}</strong> sessions</span>
            <span className="text-brand-400">·</span>
            <span className="text-xs text-brand-700"><strong className="font-semibold">{totalHours}h</strong> studied</span>
          </div>
        </div>

        <div className="flex-shrink-0 flex flex-col items-center gap-1">
          <svg width="80" height="80" viewBox="0 0 40 40" className="-rotate-90">
            <circle cx="20" cy="20" r={radius} fill="none" stroke="currentColor" strokeWidth="4" className="text-brand-200 dark:text-brand-900/60" />
            <circle cx="20" cy="20" r={radius} fill="none" stroke="#185FA5" strokeWidth="4" strokeLinecap="round" strokeDasharray={`${strokeDash} ${circumference}`} className="transition-all duration-700" />
          </svg>
          <div className="text-center -mt-[68px] mb-[16px] pointer-events-none">
            <p className="text-lg font-semibold text-brand-800">{readiness}%</p>
            <p className="text-[9px] text-brand-600 font-medium uppercase tracking-wide">READY</p>
          </div>
        </div>
      </div>
    </button>
    <ExamDateDialog
      open={dateOpen}
      onOpenChange={setDateOpen}
      onSaved={(date) => {
        setExamDate(date)
        setTimeLeft(calcTimeLeft(date))
      }}
    />
    </>
  )
}
