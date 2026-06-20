'use client'

import { useState, useEffect, useRef } from 'react'
import { ArrowLeft, Timer, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { IQ_QUESTION_TYPES, IQ_TIME_TARGET_S } from '@/lib/constants'
import { saveDrillResult } from '@/lib/drill-results'
import { notifyTokens, tokensFromRes } from '@/lib/notify-tokens'
import { IQFigure, isSvg } from './IQFigure'
import type { IQQuestion, IQType, Confidence } from '@/types/database'

interface Props {
  type: IQType | 'random'
  onBack: () => void
}

type Phase = 'loading' | 'confidence' | 'question' | 'answered' | 'done'

interface Result {
  questionId: string
  correct: boolean
  confidence: Confidence
  timeTaken: number
  selectedAnswer: string
}

export function IQDrillSession({ type, onBack }: Props) {
  const [phase, setPhase] = useState<Phase>('loading')
  const [questions, setQuestions] = useState<IQQuestion[]>([])
  const [qIndex, setQIndex] = useState(0)
  const [confidence, setConfidence] = useState<Confidence | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const [results, setResults] = useState<Result[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const startTime = useRef(0)

  const typeLabel = type === 'random' ? 'Random Mix' : IQ_QUESTION_TYPES.find(t => t.id === type)?.label ?? type

  useEffect(() => {
    loadQuestions()
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [])

  async function loadQuestions() {
    try {
      const res = await fetch('/api/ai/generate-iq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, count: 10, difficulty: 'mixed' }),
      })
      const data = await res.json()
      notifyTokens(tokensFromRes(res))
      setQuestions(data.questions ?? data)
      setPhase('confidence')
    } catch {
      toast.error('Failed to load questions')
    }
  }

  function startQuestion() {
    setElapsed(0)
    startTime.current = Date.now()
    timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000)
    setPhase('question')
  }

  function selectAnswer(opt: string) {
    if (phase !== 'question') return
    if (timerRef.current) clearInterval(timerRef.current)
    const taken = Math.round((Date.now() - startTime.current) / 1000)
    setSelected(opt)
    setPhase('answered')
    const q = questions[qIndex]
    setResults(prev => [...prev, {
      questionId: q.id,
      correct: opt === q.correct_answer,
      confidence: confidence!,
      timeTaken: taken,
      selectedAnswer: opt,
    }])
  }

  async function nextQuestion() {
    if (qIndex + 1 >= questions.length) {
      await saveResults()
      setPhase('done')
      return
    }
    setQIndex(i => i + 1)
    setSelected(null)
    setConfidence(null)
    setPhase('confidence')
  }

  async function saveResults() {
    const supabase = createClient()
    const today = new Date().toISOString().split('T')[0]

    await supabase.from('iq_attempts').insert(
      results.map(r => ({
        question_id: r.questionId,
        selected_answer: r.selectedAnswer,
        is_correct: r.correct,
        time_taken_s: r.timeTaken,
        confidence: r.confidence,
      }))
    )

    const correct = results.filter(r => r.correct).length
    const pct = Math.round((correct / results.length) * 100)
    const avgTime = Math.round(results.reduce((s, r) => s + r.timeTaken, 0) / results.length)

    saveDrillResult({ section: 'iq', score: correct, total: results.length })

    if (type !== 'random') {
      const { data: existing } = await supabase.from('iq_stats').select('*').eq('type', type).single()
      const total = (existing?.total_attempted ?? 0) + results.length
      const newPct = existing?.total_attempted
        ? Math.round(((existing.accuracy_pct * existing.total_attempted) + (pct * results.length)) / total)
        : pct

      await supabase.from('iq_stats').upsert({
        type,
        accuracy_pct: newPct,
        avg_time_s: avgTime,
        total_attempted: total,
        last_drilled: today,
      }, { onConflict: 'type' })
    }
  }

  const q = questions[qIndex]
  const opts = ['A', 'B', 'C', 'D'] as const
  const overTime = elapsed >= IQ_TIME_TARGET_S

  if (phase === 'loading') return (
    <div className="py-20 text-center">
      <div className="w-6 h-6 border-2 border-gray-200 border-t-brand-600 rounded-full animate-spin mx-auto mb-3" />
      <p className="text-sm text-gray-400">Loading questions…</p>
    </div>
  )

  if (phase === 'done') {
    const correct = results.filter(r => r.correct).length
    const pct = Math.round((correct / results.length) * 100)
    const sureResults = results.filter(r => r.confidence === 'sure')
    const sureCorrect = sureResults.filter(r => r.correct).length
    return (
      <div>
        <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-gray-400 mb-6 hover:text-gray-600 transition-colors">
          <ArrowLeft size={16} /> Back to types
        </button>
        <div className="text-center mb-6">
          <p className="text-4xl font-medium text-gray-900 tabular-nums">{correct}/{results.length}</p>
          <p className="text-lg text-gray-500 mt-1">{pct}%</p>
          <p className="text-sm text-gray-400 mt-1">{typeLabel}</p>
        </div>
        {sureResults.length > 0 && (
          <div className="bg-purple-50 rounded-xl p-4 mb-4">
            <p className="text-xs font-semibold text-purple-800 mb-1">Confidence calibration</p>
            <p className="text-sm text-purple-700">
              You said Sure {sureResults.length}×, got {sureCorrect} right ({Math.round(sureCorrect / sureResults.length * 100)}%)
            </p>
          </div>
        )}
        <div className="flex gap-3">
          <button onClick={loadQuestions} className="flex-1 py-3 bg-brand-600 text-white text-sm font-medium rounded-xl hover:bg-brand-800 transition-colors">
            Drill again
          </button>
          <button onClick={onBack} className="flex-1 py-3 border border-gray-200 text-gray-600 text-sm font-medium rounded-xl hover:bg-gray-50 transition-colors">
            Back to types
          </button>
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <button onClick={onBack} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors">
          <X size={18} />
        </button>
        <div className="flex items-center gap-2">
          {questions.map((_, i) => (
            <div key={i} className={cn('w-1.5 h-1.5 rounded-full transition-colors', i < qIndex ? 'bg-brand-400' : i === qIndex ? 'bg-brand-600' : 'bg-gray-200')} />
          ))}
        </div>
        <div className={cn('flex items-center gap-1 text-xs font-mono tabular-nums', overTime ? 'text-danger-400' : 'text-gray-400')}>
          <Timer size={12} />
          {Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, '0')}
        </div>
      </div>

      {/* Category + difficulty */}
      {q && (
        <div className="flex items-center gap-2 mb-4">
          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-brand-50 text-brand-800">{typeLabel}</span>
          <span className="text-xs text-gray-400 capitalize">{q.difficulty}</span>
          <span className="text-xs text-gray-300">{qIndex + 1} / {questions.length}</span>
        </div>
      )}

      {/* Question */}
      {q && (
        <div className="bg-gray-50 dark:bg-[#1C2128] rounded-xl p-5 mb-5">
          <p className="text-base font-medium text-gray-900 dark:text-gray-100 leading-relaxed text-center">{q.question_text}</p>
          {q.question_figure && isSvg(q.question_figure) && (
            <div className="mt-4 flex justify-center overflow-x-auto">
              <IQFigure svg={q.question_figure} className="w-full max-w-md" />
            </div>
          )}
        </div>
      )}

      {/* Confidence — shown BEFORE options */}
      {phase === 'confidence' && (
        <div>
          <p className="text-xs font-medium text-gray-500 mb-3 text-center">How confident are you?</p>
          <div className="grid grid-cols-3 gap-2">
            {(['sure', 'unsure', 'guessing'] as Confidence[]).map(c => (
              <button
                key={c}
                onClick={() => { setConfidence(c); startQuestion() }}
                className="py-3 text-sm font-medium border border-gray-200 rounded-xl hover:border-brand-400 hover:bg-brand-50 hover:text-brand-700 transition-all capitalize"
              >
                {c}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Options */}
      {q && (phase === 'question' || phase === 'answered') && (() => {
        const figureOptions = isSvg(q.options.A) || isSvg(q.options.B) || isSvg(q.options.C) || isSvg(q.options.D)
        return (
          <div className={cn(figureOptions ? 'grid grid-cols-2 gap-2' : 'space-y-2')}>
            {opts.map(opt => {
              const value = q.options[opt]
              const isCorrect = opt === q.correct_answer
              const isSelected = opt === selected
              const figure = isSvg(value)
              return (
                <button
                  key={opt}
                  onClick={() => selectAnswer(opt)}
                  disabled={phase === 'answered'}
                  className={cn(
                    'rounded-xl border-2 text-sm transition-all duration-150',
                    figure ? 'flex flex-col items-center justify-center gap-2 p-4 min-h-[120px]' : 'w-full flex items-start gap-3 px-4 py-3.5 text-left min-h-[52px]',
                    phase === 'answered' && isCorrect && 'bg-success-50 dark:bg-green-900/30 border-success-400 text-success-800 dark:text-green-300',
                    phase === 'answered' && isSelected && !isCorrect && 'bg-danger-50 dark:bg-red-900/30 border-danger-400 text-danger-800 dark:text-red-300',
                    phase === 'question' && 'border-gray-200 dark:border-[#30363D] hover:border-brand-400 hover:bg-brand-50 dark:hover:bg-brand-900/10 cursor-pointer active:scale-[0.99]',
                    phase === 'answered' && !isCorrect && !isSelected && 'border-gray-100 dark:border-gray-800 text-gray-400'
                  )}
                >
                  {figure ? (
                    <>
                      <IQFigure svg={value} className="w-20 h-20" />
                      <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">{opt}</span>
                    </>
                  ) : (
                    <>
                      <span className="font-semibold flex-shrink-0 w-4">{opt}.</span>
                      <span className="flex-1">{value}</span>
                    </>
                  )}
                </button>
              )
            })}
          </div>
        )
      })()}

      {/* Explanation */}
      {phase === 'answered' && q && (
        <div className="mt-4">
          <div className={cn('rounded-xl p-4 mb-3', results[results.length-1]?.correct ? 'bg-success-50' : 'bg-danger-50')}>
            <p className={cn('text-xs font-semibold mb-1', results[results.length-1]?.correct ? 'text-success-400' : 'text-danger-400')}>
              {results[results.length-1]?.correct ? 'Correct' : 'Incorrect'} · {confidence}
            </p>
            <p className="text-sm text-gray-700 leading-relaxed">{q.explanation}</p>
          </div>
          <button
            onClick={nextQuestion}
            className="w-full py-3 bg-brand-600 text-white text-sm font-medium rounded-xl hover:bg-brand-800 transition-colors active:scale-[0.98]"
          >
            {qIndex + 1 >= questions.length ? 'See results' : 'Next question →'}
          </button>
        </div>
      )}
    </div>
  )
}
