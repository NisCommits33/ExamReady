'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ExamDateDialog } from '@/components/shared/ExamDateDialog'

interface TimeLeft {
  days: number
  hours: number
  minutes: number
  seconds: number
  isPast: boolean
}

function calcTimeLeft(examDate: string): TimeLeft {
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

export function ExamCountdown({ compact = false }: { compact?: boolean }) {
  const [examDate, setExamDate] = useState<string | null>(null)
  const [timeLeft, setTimeLeft] = useState<TimeLeft | null>(null)
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

  if (!timeLeft) return null

  const label = timeLeft.isPast ? 'Exam passed' : 'Days to exam'
  const dateStr = examDate ? new Date(examDate).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }) : ''

  if (compact) {
    return (
      <>
        <button type="button" onClick={() => setDateOpen(true)} title="Set exam date" className="w-full text-left bg-brand-50 dark:bg-brand-900/20 rounded-xl p-3 hover:bg-brand-100 dark:hover:bg-brand-900/30 transition-colors">
          <p className="text-[11px] text-brand-600 dark:text-brand-400 font-medium uppercase tracking-wide mb-0.5">{label}</p>
          <p className="text-3xl font-semibold text-brand-800 dark:text-brand-300 leading-none">{timeLeft.days}</p>
          <p className="text-[11px] text-brand-600 dark:text-brand-400 mt-1 font-mono tabular-nums">
            {String(timeLeft.hours).padStart(2, '0')}h {String(timeLeft.minutes).padStart(2, '0')}m {String(timeLeft.seconds).padStart(2, '0')}s
          </p>
          {dateStr && <p className="text-[10px] text-brand-500 mt-0.5">{dateStr}</p>}
        </button>
        <ExamDateDialog open={dateOpen} onOpenChange={setDateOpen} />
      </>
    )
  }

  return (
    <>
      <button type="button" onClick={() => setDateOpen(true)} title="Set exam date" className="w-full text-left bg-brand-50 border border-brand-100 dark:border-brand-900/40 rounded-xl p-4 hover:border-brand-300 dark:hover:border-brand-700 transition-colors">
        <p className="text-[11px] text-brand-600 font-medium uppercase tracking-wide mb-1">{label}</p>
        <div className="flex items-baseline gap-1.5">
          <span className="text-[64px] font-medium text-brand-800 leading-none tracking-tight" style={{ letterSpacing: '-0.03em' }}>
            {timeLeft.days}
          </span>
          <span className="text-xl text-brand-600 font-medium">days</span>
        </div>
        <p className="text-sm font-mono tabular-nums text-brand-700 dark:text-brand-400 mt-1">
          {String(timeLeft.hours).padStart(2, '0')}:{String(timeLeft.minutes).padStart(2, '0')}:{String(timeLeft.seconds).padStart(2, '0')}
        </p>
        {dateStr && <p className="text-xs text-brand-600 mt-1">{dateStr}</p>}
      </button>
      <ExamDateDialog open={dateOpen} onOpenChange={setDateOpen} />
    </>
  )
}
