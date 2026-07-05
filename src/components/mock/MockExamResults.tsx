'use client'

import { cn } from '@/lib/utils'
import type { DrillQuestion } from '@/lib/mcq'

export interface MockReview {
  question: DrillQuestion
  selected: string | null
}

interface Props {
  reviews: MockReview[]
  correct: number
  total: number
  adjusted: number
  passMark: number
  passed: boolean
  negativeMarking: number
  elapsedSeconds: number
  onRetry: () => void
}

export function MockExamResults({ reviews, correct, total, adjusted, passMark, passed, negativeMarking, elapsedSeconds, onRetry }: Props) {
  const answered = reviews.filter(r => r.selected != null).length
  const wrong = answered - correct
  const pct = total > 0 ? Math.round((adjusted / total) * 100) : 0
  const mins = Math.floor(elapsedSeconds / 60)
  const secs = elapsedSeconds % 60

  return (
    <div>
      {/* Score banner */}
      <div className={cn('rounded-2xl p-6 mb-5 text-center border', passed
        ? 'bg-success-50 dark:bg-green-900/20 border-success-200 dark:border-green-800/50'
        : 'bg-danger-50 dark:bg-red-900/20 border-danger-200 dark:border-red-800/50')}>
        <p className={cn('text-xs font-semibold uppercase tracking-wide mb-1', passed ? 'text-success-500' : 'text-danger-400')}>
          {passed ? 'Passed' : 'Not passed'}
        </p>
        <p className="text-4xl font-medium text-gray-900 dark:text-gray-100 tabular-nums">{adjusted.toFixed(2)}<span className="text-2xl text-gray-400">/{total}</span></p>
        <p className="text-lg text-gray-500 mt-1">{pct}% · pass mark {passMark}%</p>
      </div>

      {/* Breakdown */}
      <div className="grid grid-cols-4 gap-2 mb-6 text-center">
        <Stat label="Correct" value={String(correct)} tone="good" />
        <Stat label="Wrong" value={String(wrong)} tone="bad" />
        <Stat label="Skipped" value={String(total - answered)} tone="muted" />
        <Stat label="Time" value={`${mins}:${String(secs).padStart(2, '0')}`} tone="muted" />
      </div>
      {negativeMarking > 0 && (
        <p className="text-[11px] text-gray-400 text-center -mt-4 mb-5">Negative marking: −{negativeMarking} per wrong answer ({wrong} × −{negativeMarking} = −{(wrong * negativeMarking).toFixed(2)})</p>
      )}

      <button onClick={onRetry} className="w-full py-3 mb-6 bg-brand-600 text-white text-sm font-medium rounded-xl hover:bg-brand-800 transition-colors active:scale-[0.98]">
        New mock exam
      </button>

      {/* Review */}
      <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">Review</p>
      <div className="space-y-3">
        {reviews.map((r, i) => {
          const isCorrect = r.selected === r.question.correct
          const opts = ['A', 'B', 'C', 'D'] as const
          return (
            <div key={i} className="border border-gray-200 dark:border-[#30363D] rounded-xl p-4">
              <div className="flex items-start gap-2 mb-2">
                <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0 mt-0.5',
                  r.selected == null ? 'bg-gray-100 dark:bg-[#30363D] text-gray-500' : isCorrect ? 'bg-success-100 text-success-700 dark:bg-green-900/40 dark:text-green-300' : 'bg-danger-100 text-danger-700 dark:bg-red-900/40 dark:text-red-300')}>
                  {r.selected == null ? 'Skipped' : isCorrect ? 'Correct' : 'Wrong'}
                </span>
                <p className="text-sm text-gray-900 dark:text-gray-100 leading-relaxed">Q{i + 1}. {r.question.question}</p>
              </div>
              <div className="space-y-1 ml-1">
                {opts.map(o => {
                  const text = r.question.options[o]
                  if (!text) return null
                  const isAns = o === r.question.correct
                  const isSel = o === r.selected
                  return (
                    <div key={o} className={cn('text-xs px-2 py-1 rounded flex gap-2',
                      isAns ? 'text-success-700 dark:text-green-300 font-medium' : isSel ? 'text-danger-600 dark:text-red-300 line-through' : 'text-gray-500 dark:text-gray-400')}>
                      <span className="font-semibold w-3">{o}.</span><span>{text}</span>
                    </div>
                  )
                })}
              </div>
              {r.question.explanation && <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 leading-relaxed border-t border-gray-100 dark:border-[#21262D] pt-2">{r.question.explanation}</p>}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function Stat({ label, value, tone }: { label: string; value: string; tone: 'good' | 'bad' | 'muted' }) {
  return (
    <div className="bg-gray-50 dark:bg-[#1C2128] rounded-xl py-3">
      <p className={cn('text-xl font-medium tabular-nums', tone === 'good' ? 'text-success-600 dark:text-green-400' : tone === 'bad' ? 'text-danger-500' : 'text-gray-700 dark:text-gray-300')}>{value}</p>
      <p className="text-[11px] text-gray-400 mt-0.5">{label}</p>
    </div>
  )
}
