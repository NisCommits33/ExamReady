'use client'

import { useState } from 'react'
import { Flame, Timer } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { ARFF_CATEGORIES } from '@/lib/constants'

type Phase = 'grid' | 'loading' | 'question' | 'answered' | 'done'

interface Question {
  question_text: string
  options: Record<string, string>
  correct_answer: string
  explanation: string
  difficulty: string
}

const CATEGORY_ICONS: Record<string, string> = {
  foam_agents: '🧪',
  vehicles: '🚒',
  rescue_ops: '🛟',
  icao_annex14: '📋',
  fire_classes: '🔥',
  medical_first: '🏥',
  local_procedures: '✈️',
}

export function ARFFClient() {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [phase, setPhase] = useState<Phase>('grid')
  const [questions, setQuestions] = useState<Question[]>([])
  const [qIndex, setQIndex] = useState(0)
  const [selected, setSelected] = useState<string | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const [timerRef, setTimerRef] = useState<ReturnType<typeof setInterval> | null>(null)
  const [results, setResults] = useState<{ correct: boolean }[]>([])

  async function startDrill(category: string) {
    setSelectedCategory(category)
    setPhase('loading')
    setResults([])
    setQIndex(0)
    setElapsed(0)
    try {
      const res = await fetch('/api/ai/generate-arff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category, count: 10 }),
      })
      const data = await res.json()
      setQuestions(data.questions ?? [])
      setPhase('question')
      const ref = setInterval(() => setElapsed(e => e + 1), 1000)
      setTimerRef(ref)
    } catch {
      toast.error('Failed to generate questions')
      setPhase('grid')
    }
  }

  function selectAnswer(opt: string) {
    if (phase !== 'question') return
    if (timerRef) clearInterval(timerRef)
    setSelected(opt)
    setPhase('answered')
    setResults(prev => [...prev, { correct: opt === questions[qIndex].correct_answer }])
  }

  function next() {
    if (qIndex + 1 >= questions.length) { setPhase('done'); return }
    setQIndex(i => i + 1)
    setSelected(null)
    setPhase('question')
    setElapsed(0)
    const ref = setInterval(() => setElapsed(e => e + 1), 1000)
    setTimerRef(ref)
  }

  function reset() {
    setPhase('grid')
    setSelectedCategory(null)
    setQuestions([])
    setQIndex(0)
    setSelected(null)
    setResults([])
    setElapsed(0)
  }

  if (phase === 'grid') return (
    <div>
      <div className="mb-5">
        <h1 className="text-lg font-medium text-gray-900 dark:text-gray-100">ARFF Drills</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Aviation Rescue & Fire Fighting · CAAN exam MCQs</p>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        {ARFF_CATEGORIES.map(cat => (
          <button
            key={cat.id}
            onClick={() => startDrill(cat.id)}
            className={cn(
              'flex flex-col items-start gap-2.5 p-4 rounded-xl text-left',
              'bg-white dark:bg-[#161B22] border border-gray-200 dark:border-[#30363D]',
              'hover:border-danger-400 hover:shadow-sm active:scale-[0.98] transition-all duration-150'
            )}
          >
            <span className="text-xl">{CATEGORY_ICONS[cat.id] ?? '🔥'}</span>
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100 leading-snug">{cat.label}</p>
          </button>
        ))}
      </div>

      <button
        onClick={() => startDrill('random')}
        className="w-full py-3.5 bg-danger-400 text-white text-sm font-medium rounded-xl hover:bg-danger-800 transition-colors active:scale-[0.98]"
      >
        Random ARFF mix · 10 Qs
      </button>
    </div>
  )

  if (phase === 'loading') return (
    <div className="py-20 text-center">
      <div className="w-6 h-6 border-2 border-gray-200 border-t-danger-400 rounded-full animate-spin mx-auto mb-3" />
      <p className="text-sm text-gray-400">Generating ARFF questions…</p>
    </div>
  )

  if (phase === 'done') {
    const correct = results.filter(r => r.correct).length
    return (
      <div className="py-8 text-center">
        <Flame size={32} className="mx-auto mb-3 text-danger-400" />
        <p className="text-4xl font-medium text-gray-900 dark:text-gray-100 tabular-nums">{correct}/{results.length}</p>
        <p className="text-lg text-gray-500 mt-1">{Math.round(correct / results.length * 100)}%</p>
        <p className="text-sm text-gray-400 mt-1 mb-6">
          {ARFF_CATEGORIES.find(c => c.id === selectedCategory)?.label ?? 'Random mix'}
        </p>
        <div className="flex gap-3">
          <button onClick={() => startDrill(selectedCategory!)} className="flex-1 py-3 bg-danger-400 text-white text-sm font-medium rounded-xl hover:bg-danger-800 transition-colors">
            Try again
          </button>
          <button onClick={reset} className="flex-1 py-3 border border-gray-200 dark:border-[#30363D] text-gray-600 dark:text-gray-400 text-sm font-medium rounded-xl hover:bg-gray-50 dark:hover:bg-[#1C2128] transition-colors">
            Back
          </button>
        </div>
      </div>
    )
  }

  const q = questions[qIndex]
  const opts = ['A', 'B', 'C', 'D'] as const
  const overTime = elapsed >= 54

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-1">
          {questions.map((_, i) => (
            <div key={i} className={cn('w-6 h-1 rounded-full transition-colors', i < qIndex ? 'bg-danger-400' : i === qIndex ? 'bg-danger-400' : 'bg-gray-200 dark:bg-gray-700')} />
          ))}
        </div>
        <div className={cn('flex items-center gap-1 text-xs font-mono tabular-nums', overTime ? 'text-danger-400' : 'text-gray-400')}>
          <Timer size={12} />
          {Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, '0')}
        </div>
      </div>

      {q && (
        <div className="bg-gray-50 dark:bg-[#1C2128] rounded-xl p-5 mb-5">
          <p className="text-xs text-gray-400 mb-2">Q{qIndex + 1} / {questions.length} · <span className="capitalize">{q.difficulty}</span></p>
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100 leading-relaxed">{q.question_text}</p>
        </div>
      )}

      {q && (phase === 'question' || phase === 'answered') && (
        <div className="space-y-2">
          {opts.map(opt => {
            const text = q.options[opt]
            if (!text) return null
            const isCorrect = opt === q.correct_answer
            const isSelected = opt === selected
            return (
              <button
                key={opt}
                onClick={() => selectAnswer(opt)}
                disabled={phase === 'answered'}
                className={cn(
                  'w-full flex items-start gap-3 px-4 py-3.5 text-left rounded-xl border-2 text-sm transition-all duration-150',
                  phase === 'answered' && isCorrect && 'bg-success-50 dark:bg-green-900/30 border-success-400 text-success-800 dark:text-green-300',
                  phase === 'answered' && isSelected && !isCorrect && 'bg-danger-50 dark:bg-red-900/30 border-danger-400 text-danger-800 dark:text-red-300',
                  phase === 'question' && 'border-gray-200 dark:border-[#30363D] bg-white dark:bg-[#161B22] hover:border-danger-400 hover:bg-danger-50 dark:hover:bg-red-900/10 cursor-pointer',
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

      {phase === 'answered' && q && (
        <div className="mt-4">
          <div className={cn('rounded-xl p-4 mb-3', results[results.length - 1]?.correct ? 'bg-success-50 dark:bg-green-900/20' : 'bg-danger-50 dark:bg-red-900/20')}>
            <p className={cn('text-xs font-semibold mb-1 uppercase tracking-wide', results[results.length - 1]?.correct ? 'text-success-400' : 'text-danger-400')}>
              {results[results.length - 1]?.correct ? 'Correct' : 'Incorrect'}
            </p>
            <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{q.explanation}</p>
          </div>
          <button onClick={next} className="w-full py-3 bg-danger-400 text-white text-sm font-medium rounded-xl hover:bg-danger-800 transition-colors active:scale-[0.98]">
            {qIndex + 1 >= questions.length ? 'See results' : 'Next →'}
          </button>
        </div>
      )}
    </div>
  )
}
