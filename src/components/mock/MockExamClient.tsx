'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Loader2, Timer } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { saveDrillResult } from '@/lib/drill-results'
import { MockExamResults, type MockReview } from './MockExamResults'
import type { DrillQuestion } from '@/lib/mcq'

type Phase = 'setup' | 'loading' | 'exam' | 'results'

interface Props {
  examId: string
  examName: string
  negativeMarking: number
  passMark: number
  secondsPerQuestion: number
}

const COUNTS = [10, 20, 30, 50]

export function MockExamClient({ examId, examName, negativeMarking, passMark, secondsPerQuestion }: Props) {
  const [phase, setPhase] = useState<Phase>('setup')
  const [count, setCount] = useState(50)
  const [questions, setQuestions] = useState<DrillQuestion[]>([])
  const [answers, setAnswers] = useState<Record<number, string>>({})
  const [current, setCurrent] = useState(0)
  const [timeLeft, setTimeLeft] = useState(0)
  const [totalTime, setTotalTime] = useState(0)

  const totalRef = useRef(0)
  const remainingRef = useRef(0)
  const answersRef = useRef<Record<number, string>>({})
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const [review, setReview] = useState<MockReview[]>([])
  const [score, setScore] = useState({ correct: 0, adjusted: 0, total: 0, passed: false, elapsed: 0 })

  const stopTimer = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
  }, [])
  useEffect(() => () => stopTimer(), [stopTimer])

  const select = (opt: string) => {
    setAnswers(a => {
      const next = { ...a, [current]: opt }
      answersRef.current = next
      return next
    })
  }

  const submit = useCallback((qs: DrillQuestion[]) => {
    stopTimer()
    const chosen = answersRef.current
    const reviews: MockReview[] = qs.map((q, i) => ({ question: q, selected: chosen[i] ?? null }))
    const correct = reviews.filter(r => r.selected === r.question.correct).length
    const answered = reviews.filter(r => r.selected != null).length
    const wrong = answered - correct
    const total = qs.length
    const adjusted = Math.max(0, correct - wrong * negativeMarking)
    const passed = total > 0 && (adjusted / total) * 100 >= passMark
    const elapsed = totalRef.current - Math.max(0, remainingRef.current)

    setReview(reviews)
    setScore({ correct, adjusted, total, passed, elapsed })
    setPhase('results')

    saveDrillResult({ section: 'gk', score: correct, total })
    const supabase = createClient()
    void supabase.from('mock_exam_attempts').insert({
      exam_id: examId,
      mcq_correct: correct,
      mcq_total: total,
      mcq_score_adjusted: adjusted,
      pass_mark: passMark,
      passed,
      duration_s: elapsed,
    })
  }, [stopTimer, negativeMarking, passMark, examId])

  async function start() {
    setPhase('loading')
    setAnswers({}); answersRef.current = {}; setCurrent(0)
    try {
      const res = await fetch('/api/mcq/draw', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ examId, count }),
      })
      const json = await res.json().catch(() => ({}))
      const qs = (json.questions ?? []) as DrillQuestion[]
      if (qs.length === 0) {
        toast.error('No question bank for this exam yet — add MCQs in the admin panel first.')
        setPhase('setup'); return
      }
      setQuestions(qs)
      const total = qs.length * secondsPerQuestion
      totalRef.current = total
      remainingRef.current = total
      setTotalTime(total)
      setTimeLeft(total)
      timerRef.current = setInterval(() => {
        remainingRef.current -= 1
        setTimeLeft(Math.max(0, remainingRef.current))
        if (remainingRef.current <= 0) submit(qs)
      }, 1000)
      setPhase('exam')
    } catch {
      toast.error('Failed to load questions'); setPhase('setup')
    }
  }

  // ── Setup ───────────────────────────────────────────────
  if (phase === 'setup') {
    const totalMin = Math.round((count * secondsPerQuestion) / 60)
    return (
      <div className="py-4">
        <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">Mock Exam</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">{examName}</p>

        <div className="bg-brand-50 dark:bg-brand-900/15 border border-brand-200 dark:border-brand-800 rounded-xl p-5 mb-5">
          <ul className="space-y-1.5 text-sm text-brand-800 dark:text-brand-200">
            <li>{count} MCQs drawn from the question bank</li>
            <li>{totalMin}-minute limit ({secondsPerQuestion}s / question) — auto-submits at 0</li>
            <li>Answers stay editable until you submit (no live feedback)</li>
            <li>Negative marking: {negativeMarking > 0 ? `−${negativeMarking} per wrong answer` : 'none'}</li>
            <li>Pass mark: {passMark}%</li>
          </ul>
        </div>

        <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wide mb-1.5">Questions</p>
        <div className="flex flex-wrap gap-1.5 mb-5">
          {COUNTS.map(c => (
            <button key={c} onClick={() => setCount(c)}
              className={cn('px-3.5 py-1.5 text-sm font-medium rounded-lg border transition-colors',
                count === c ? 'bg-brand-600 text-white border-brand-600' : 'border-gray-200 dark:border-[#30363D] text-gray-600 dark:text-gray-400 hover:border-gray-300')}>
              {c}
            </button>
          ))}
        </div>

        <button onClick={start} className="w-full py-3 bg-brand-600 text-white text-sm font-medium rounded-xl hover:bg-brand-800 transition-colors active:scale-[0.98]">
          Start mock exam
        </button>
      </div>
    )
  }

  if (phase === 'loading') {
    return (
      <div className="py-20 text-center">
        <Loader2 size={22} className="animate-spin text-brand-400 mx-auto mb-3" />
        <p className="text-sm text-gray-400">Drawing your questions…</p>
      </div>
    )
  }

  if (phase === 'results') {
    return (
      <div className="py-4">
        <MockExamResults
          reviews={review}
          correct={score.correct}
          total={score.total}
          adjusted={score.adjusted}
          passMark={passMark}
          passed={score.passed}
          negativeMarking={negativeMarking}
          elapsedSeconds={score.elapsed}
          onRetry={() => setPhase('setup')}
        />
      </div>
    )
  }

  // ── Exam ────────────────────────────────────────────────
  const q = questions[current]
  const opts = ['A', 'B', 'C', 'D'] as const
  const mins = Math.floor(timeLeft / 60)
  const secs = timeLeft % 60
  const answeredCount = Object.keys(answers).length
  const timerColor = timeLeft > totalTime * 0.5 ? 'text-success-500' : timeLeft > totalTime * 0.2 ? 'text-warning-500' : 'text-danger-500'

  return (
    <div className="w-full min-w-0 overflow-hidden py-2">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <span className="text-xs text-gray-400">{answeredCount}/{questions.length} answered</span>
        <div className={cn('flex items-center gap-1 text-sm font-mono tabular-nums', timerColor)}>
          <Timer size={14} />{mins}:{String(secs).padStart(2, '0')}
        </div>
      </div>

      {/* Question palette */}
      <div className="mb-4 w-full min-w-0 overflow-hidden rounded-xl border border-gray-200 bg-white/70 p-2 dark:border-[#30363D] dark:bg-[#161B22]/70">
        <div
          className="grid max-h-28 w-full grid-cols-[repeat(auto-fill,minmax(2rem,1fr))] gap-1.5 overflow-y-auto pr-1 [scrollbar-width:thin] sm:flex sm:max-h-none sm:max-w-full sm:overflow-x-auto sm:overflow-y-hidden sm:pb-1 sm:pr-0 [-webkit-overflow-scrolling:touch]"
          aria-label="Question navigation"
        >
          {questions.map((_, i) => (
            <button key={i} onClick={() => setCurrent(i)}
              aria-label={`Go to question ${i + 1}`}
              aria-current={i === current ? 'step' : undefined}
              className={cn('h-8 w-full rounded-lg px-2 text-xs font-medium transition-all sm:min-w-8 sm:w-auto',
                i === current ? 'bg-brand-600 text-white shadow-sm' : answers[i] ? 'bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-400' : 'bg-gray-100 dark:bg-[#1C2128] text-gray-500 hover:bg-gray-200 dark:hover:bg-[#30363D]')}>
              {i + 1}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-gray-50 dark:bg-[#1C2128] rounded-xl p-5 mb-4">
        <p className="text-xs text-gray-400 mb-2">Q{current + 1} / {questions.length}</p>
        <p className="text-sm font-medium text-gray-900 dark:text-gray-100 leading-relaxed">{q.question}</p>
      </div>

      <div className="space-y-2 mb-5">
        {opts.map(opt => {
          const text = q.options[opt]
          if (!text) return null
          const isSel = answers[current] === opt
          return (
            <button key={opt} onClick={() => select(opt)}
              className={cn('w-full flex items-start gap-3 px-4 py-3.5 text-left rounded-xl border-2 text-sm transition-all duration-150',
                isSel ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20 text-brand-900 dark:text-brand-200'
                  : 'border-gray-200 dark:border-[#30363D] bg-white dark:bg-[#161B22] hover:border-brand-300 hover:bg-brand-50/50 dark:hover:bg-brand-900/10')}>
              <span className="font-semibold flex-shrink-0 w-4">{opt}.</span>
              <span className="flex-1">{text}</span>
            </button>
          )
        })}
      </div>

      <div className="flex gap-2">
        <button onClick={() => setCurrent(i => Math.max(0, i - 1))} disabled={current === 0}
          className="px-4 py-2.5 text-sm text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-[#30363D] rounded-xl disabled:opacity-30 hover:bg-gray-50 dark:hover:bg-[#1C2128] transition-colors">
          Prev
        </button>
        {current < questions.length - 1 ? (
          <button onClick={() => setCurrent(i => i + 1)}
            className="flex-1 py-2.5 text-sm font-medium text-white bg-brand-600 rounded-xl hover:bg-brand-800 transition-colors">
            Next
          </button>
        ) : (
          <button onClick={() => submit(questions)}
            className="flex-1 py-2.5 text-sm font-medium text-white bg-brand-600 rounded-xl hover:bg-brand-800 transition-colors">
            Submit exam
          </button>
        )}
      </div>
    </div>
  )
}
