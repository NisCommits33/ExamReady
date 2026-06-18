'use client'

import { useState } from 'react'
import { Award, ChevronDown, ChevronUp, CheckCircle2, XCircle, Sparkles, RotateCcw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Markdown } from '@/components/ui/Markdown'

interface GradeResult {
  score: number
  feedback: string
  strong: string[]
  missing: string[]
  model_answer: string
}

export interface ExamResult {
  topicName: string
  questionType: '5mark' | '10mark'
  questionText: string
  userAnswer: string
  grade: GradeResult
}

interface Props {
  results: ExamResult[]
  elapsedSeconds: number
  onRetry: () => void
  onBack: () => void
}

export function ARFFMockExamResults({ results, elapsedSeconds, onRetry, onBack }: Props) {
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null)

  const totalScore = results.reduce((s, r) => s + r.grade.score, 0)
  const totalMarks = results.reduce((s, r) => s + (r.questionType === '5mark' ? 5 : 10), 0)
  const pct = Math.round((totalScore / totalMarks) * 100)
  const mins = Math.floor(elapsedSeconds / 60)

  return (
    <div>
      <div className={cn(
        'rounded-xl p-6 mb-5 text-center',
        pct >= 60 ? 'bg-success-50 dark:bg-success-900/20 border border-success-200 dark:border-success-800'
          : 'bg-warning-50 dark:bg-warning-900/20 border border-warning-200 dark:border-warning-800'
      )}>
        <Award size={28} className={cn('mx-auto mb-2', pct >= 60 ? 'text-success-500' : 'text-warning-500')} />
        <p className={cn('text-4xl font-bold', pct >= 60 ? 'text-success-600' : 'text-warning-600')}>
          {totalScore}<span className="text-lg font-normal text-gray-400">/{totalMarks}</span>
        </p>
        <p className={cn('text-sm font-medium mt-1', pct >= 60 ? 'text-success-700 dark:text-success-400' : 'text-warning-700 dark:text-warning-400')}>
          {pct}% · {mins} min
        </p>
      </div>

      <div className="space-y-2 mb-5">
        {results.map((r, i) => {
          const max = r.questionType === '5mark' ? 5 : 10
          const qPct = (r.grade.score / max) * 100
          const expanded = expandedIdx === i
          return (
            <div key={i} className="border border-gray-200 dark:border-[#30363D] rounded-xl overflow-hidden">
              <button
                onClick={() => setExpandedIdx(expanded ? null : i)}
                className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-[#1C2128] transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-xs text-gray-400 font-mono flex-shrink-0">Q{i + 1}</span>
                  <span className="text-sm text-gray-700 dark:text-gray-300 truncate">{r.topicName}</span>
                  <span className="text-[10px] text-gray-400 flex-shrink-0">{r.questionType}</span>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <div className="w-12 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div className={cn('h-full rounded-full', qPct >= 60 ? 'bg-success-400' : qPct >= 40 ? 'bg-warning-400' : 'bg-danger-400')} style={{ width: `${qPct}%` }} />
                  </div>
                  <span className={cn('text-xs font-semibold', qPct >= 60 ? 'text-success-600' : qPct >= 40 ? 'text-warning-600' : 'text-danger-600')}>
                    {r.grade.score}/{max}
                  </span>
                  {expanded ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
                </div>
              </button>

              {expanded && (
                <div className="px-4 pb-4 border-t border-gray-100 dark:border-[#21262D] pt-3 space-y-3">
                  <div className="bg-teal-50 dark:bg-teal-900/20 rounded-lg p-3">
                    <p className="text-[10px] font-semibold text-teal-700 dark:text-teal-400 uppercase tracking-wide mb-1">Question</p>
                    <p className="text-sm text-teal-900 dark:text-teal-100">{r.questionText}</p>
                  </div>

                  <div><Markdown compact>{r.grade.feedback}</Markdown></div>

                  {r.grade.strong?.length > 0 && (
                    <div className="space-y-1">
                      {r.grade.strong.map((s, j) => (
                        <div key={j} className="flex items-start gap-1.5 text-xs text-success-700 dark:text-success-400">
                          <CheckCircle2 size={12} className="mt-0.5 flex-shrink-0" /><span>{s}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {r.grade.missing?.length > 0 && (
                    <div className="space-y-1">
                      {r.grade.missing.map((m, j) => (
                        <div key={j} className="flex items-start gap-1.5 text-xs text-danger-600 dark:text-danger-400">
                          <XCircle size={12} className="mt-0.5 flex-shrink-0" /><span>{m}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {r.grade.model_answer && (
                    <details className="group">
                      <summary className="flex items-center gap-1.5 text-xs font-medium text-brand-600 cursor-pointer">
                        <Sparkles size={12} /> Model answer
                      </summary>
                      <div className="mt-2"><Markdown compact>{r.grade.model_answer}</Markdown></div>
                    </details>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="flex gap-3">
        <button onClick={onRetry} className="flex-1 flex items-center justify-center gap-2 py-3 bg-teal-400 text-white text-sm font-medium rounded-xl hover:bg-teal-600 transition-colors">
          <RotateCcw size={14} /> New exam
        </button>
        <button onClick={onBack} className="flex-1 py-3 border border-gray-200 dark:border-[#30363D] text-gray-600 dark:text-gray-400 text-sm font-medium rounded-xl hover:bg-gray-50 dark:hover:bg-[#1C2128] transition-colors">
          Back to topics
        </button>
      </div>
    </div>
  )
}
