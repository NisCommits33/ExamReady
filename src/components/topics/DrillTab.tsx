'use client'

import { useState, useEffect } from 'react'
import { Timer, ToggleLeft, ToggleRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Markdown } from '@/components/ui/Markdown'
import { MCQ_TIME_LIMIT_S, NEGATIVE_MARKING_PCT } from '@/lib/constants'
import type { Topic, MCQuestion } from '@/types/database'

interface DrillTabProps { topic: Topic }

type Phase = 'idle' | 'loading' | 'question' | 'answered' | 'done'

const MCQ_PREF_KEY = 'examready_mcq_enabled'

export function DrillTab({ topic }: DrillTabProps) {
  const [phase, setPhase] = useState<Phase>('idle')
  const [mcqEnabled, setMcqEnabled] = useState(true)
  const [questions, setQuestions] = useState<MCQuestion[]>([])
  const [qIndex, setQIndex] = useState(0)
  const [selected, setSelected] = useState<string | null>(null)
  const [confidence, setConfidence] = useState<'sure' | 'unsure' | 'guessing' | null>(null)
  const [results, setResults] = useState<{ correct: boolean; confidence: string }[]>([])
  const [elapsed, setElapsed] = useState(0)
  const [timerRef, setTimerRef] = useState<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    const stored = localStorage.getItem(MCQ_PREF_KEY)
    if (stored !== null) setMcqEnabled(stored === 'true')
  }, [])

  function toggleMcq() {
    const next = !mcqEnabled
    setMcqEnabled(next)
    localStorage.setItem(MCQ_PREF_KEY, String(next))
    if (!next) setPhase('idle')
  }

  function startTimer() {
    setElapsed(0)
    const ref = setInterval(() => setElapsed(e => e + 1), 1000)
    setTimerRef(ref)
    return ref
  }

  function stopTimer(ref: ReturnType<typeof setInterval> | null) {
    if (ref) clearInterval(ref)
  }

  async function generateQuestions() {
    setPhase('loading')
    try {
      const res = await fetch('/api/ai/generate-mcq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topicId: topic.id, topicName: topic.name, subsections: topic.subsections, difficulty: 'mixed' }),
      })
      const data = await res.json()
      const qs: MCQuestion[] = data.questions ?? data
      setQuestions(qs)
      setQIndex(0)
      setResults([])
      setPhase('question')
      startTimer()
    } catch {
      toast.error('Failed to generate questions')
      setPhase('idle')
    }
  }

  function selectAnswer(opt: string) {
    if (phase !== 'question' || !confidence) return
    stopTimer(timerRef)
    setSelected(opt)
    setPhase('answered')
    const q = questions[qIndex]
    setResults(prev => [...prev, { correct: opt === q.correct, confidence: confidence }])
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
    setPhase('question')
    startTimer()
  }

  async function saveResults() {
    const correct = results.filter(r => r.correct).length
    const score = Math.max(0, correct - (results.length - correct) * NEGATIVE_MARKING_PCT)
    const scaledScore = Math.round((score / results.length) * 5)
    const supabase = createClient()
    const prev = topic.mcq_best_score ?? 0
    if (scaledScore > prev) {
      await supabase.from('topics').update({ mcq_best_score: scaledScore }).eq('id', topic.id)
    }
    toast.success(`Drill complete · ${correct}/${results.length} correct`)
  }

  if (phase === 'idle') return (
    <div>
      {/* MCQ toggle */}
      <div className="flex items-center justify-between bg-gray-50 dark:bg-[#1C2128] rounded-xl px-4 py-3 mb-6">
        <div>
          <p className="text-sm font-medium text-gray-800 dark:text-gray-200">MCQ drill</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
            {mcqEnabled ? 'AI generates 5 MCQs for memory practice' : 'MCQ practice is off — real exam has no MCQs in Paper 2'}
          </p>
        </div>
        <button
          onClick={toggleMcq}
          className="flex-shrink-0 ml-3 transition-colors"
          aria-label="Toggle MCQ drill"
        >
          {mcqEnabled
            ? <ToggleRight size={32} className="text-brand-600" />
            : <ToggleLeft size={32} className="text-gray-400" />}
        </button>
      </div>

      {mcqEnabled ? (
        <div className="py-8 text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">5 MCQs · CAAN exam style · negative marking</p>
          <p className="text-xs text-gray-400 dark:text-gray-600 mb-5">Use for memory practice — real Paper 1 has MCQs for technical topics</p>
          <button
            onClick={generateQuestions}
            className="px-6 py-2.5 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-800 transition-colors active:scale-[0.98]"
          >
            Generate 5 MCQs
          </button>
        </div>
      ) : (
        <div className="py-8 text-center">
          <p className="text-sm text-gray-400 dark:text-gray-500 mb-1">MCQ drill is disabled</p>
          <p className="text-xs text-gray-400 dark:text-gray-600">Switch to the Paper 2 tab to practise written answers instead</p>
        </div>
      )}
    </div>
  )

  if (phase === 'loading') return (
    <div className="py-12 text-center">
      <div className="w-6 h-6 border-2 border-gray-200 border-t-brand-600 rounded-full animate-spin mx-auto mb-3" />
      <p className="text-sm text-gray-400">Generating questions…</p>
    </div>
  )

  if (phase === 'done') {
    const correct = results.filter(r => r.correct).length
    const pct = Math.round((correct / results.length) * 100)
    return (
      <div className="py-8 text-center">
        <p className="text-3xl font-medium text-gray-900 dark:text-gray-100 mb-1">{correct}/{results.length}</p>
        <p className="text-sm text-gray-500 mb-4">{pct}% correct</p>
        <p className="text-xs text-gray-400 mb-6">−20% per wrong answer applied</p>
        <button
          onClick={generateQuestions}
          className="px-5 py-2.5 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-800 transition-colors"
        >
          Drill again
        </button>
      </div>
    )
  }

  const q = questions[qIndex]
  const opts = ['A', 'B', 'C', 'D'] as const
  const overTime = elapsed >= MCQ_TIME_LIMIT_S

  return (
    <div className="space-y-5">
      {/* Progress + timer */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          {questions.map((_, i) => (
            <div key={i} className={cn('w-6 h-1 rounded-full transition-colors', i < qIndex ? 'bg-brand-400' : i === qIndex ? 'bg-brand-600' : 'bg-gray-200')} />
          ))}
        </div>
        <div className={cn('flex items-center gap-1 text-xs font-mono tabular-nums', overTime ? 'text-danger-400' : 'text-gray-400')}>
          <Timer size={12} />
          {Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, '0')}
        </div>
      </div>

      {/* Question */}
      <div className="bg-gray-50 dark:bg-[#1C2128] rounded-xl p-4">
        <p className="text-sm text-gray-400 mb-2 font-medium">Q{qIndex + 1} of {questions.length}</p>
        <p className="text-sm font-medium text-gray-900 leading-relaxed">{q.question}</p>
      </div>

      {/* Confidence selector — shown before options */}
      {phase === 'question' && !confidence && (
        <div>
          <p className="text-xs font-medium text-gray-500 mb-2">How confident are you?</p>
          <div className="flex gap-2">
            {(['sure', 'unsure', 'guessing'] as const).map(c => (
              <button
                key={c}
                onClick={() => setConfidence(c)}
                className="flex-1 py-2.5 text-xs font-medium border border-gray-200 dark:border-[#30363D] dark:text-gray-300 rounded-lg hover:border-brand-400 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-900/20 transition-all capitalize"
              >
                {c}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Options — shown after confidence selected */}
      {confidence && (
        <div className="space-y-2">
          {opts.map(opt => {
            const text = q.options[opt]
            const isCorrect = opt === q.correct
            const isSelected = opt === selected
            return (
              <button
                key={opt}
                onClick={() => selectAnswer(opt)}
                disabled={phase === 'answered'}
                className={cn(
                  'w-full flex items-start gap-3 px-4 py-3.5 text-left rounded-xl border-2 text-sm transition-all duration-150 min-h-[52px]',
                  phase === 'answered' && isCorrect && 'bg-success-50 border-success-400 text-success-800',
                  phase === 'answered' && isSelected && !isCorrect && 'bg-danger-50 border-danger-400 text-danger-800',
                  phase === 'question' && 'border-gray-200 dark:border-[#30363D] hover:border-brand-400 dark:hover:border-brand-700 hover:bg-brand-50 dark:hover:bg-brand-900/20 cursor-pointer active:scale-[0.99]',
                  phase === 'answered' && !isCorrect && !isSelected && 'border-gray-100 dark:border-gray-800 text-gray-400'
                )}
              >
                <span className="font-semibold flex-shrink-0 w-4">{opt}.</span>
                <span className="flex-1">{text}</span>
              </button>
            )
          })}
        </div>
      )}

      {/* Explanation after answer */}
      {phase === 'answered' && (
        <div>
          <div className={cn('rounded-xl p-4 mb-3', results[results.length-1]?.correct ? 'bg-success-50' : 'bg-danger-50')}>
            <p className={cn('text-xs font-semibold mb-1 uppercase tracking-wide', results[results.length-1]?.correct ? 'text-success-400' : 'text-danger-400')}>
              {results[results.length-1]?.correct ? 'Correct' : 'Incorrect'} · Confidence: {confidence}
            </p>
            <Markdown compact>{q.explanation}</Markdown>
            {q.trap && (
              <p className="text-xs text-gray-500 mt-2 italic">Trap: {q.trap}</p>
            )}
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
