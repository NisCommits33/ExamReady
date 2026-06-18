'use client'

import { useState, useRef } from 'react'
import { Loader2, Timer } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { saveDrillResult } from '@/lib/drill-results'
import type { Topic } from '@/types/database'

interface Subtopic { id: string; name: string }

type Phase = 'idle' | 'loading' | 'question' | 'answered' | 'done'

interface Question {
  question: string
  options: Record<string, string>
  correct: string
  explanation: string
  trap: string
}

export function GKDrillPanel({ topic, subtopic }: { topic: Topic; subtopic?: Subtopic }) {
  const [phase, setPhase] = useState<Phase>('idle')
  const [questions, setQuestions] = useState<Question[]>([])
  const [qIndex, setQIndex] = useState(0)
  const [selected, setSelected] = useState<string | null>(null)
  const [results, setResults] = useState<{ correct: boolean }[]>([])
  const [elapsed, setElapsed] = useState(0)
  const [timerRef, setTimerRef] = useState<ReturnType<typeof setInterval> | null>(null)
  const savedRef = useRef(false)

  async function startDrill() {
    setPhase('loading')
    setResults([])
    setQIndex(0)
    setElapsed(0)
    savedRef.current = false
    try {
      const res = await fetch('/api/ai/generate-mcq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          subtopic
            ? { topicName: `${topic.name} — ${subtopic.name}`, subsections: [subtopic.name], difficulty: 'mixed', topicId: topic.id }
            : { topicName: topic.name, subsections: topic.subsections, difficulty: 'mixed', topicId: topic.id }
        ),
      })
      const data = await res.json()
      setQuestions(data.questions ?? [])
      setPhase('question')
      const ref = setInterval(() => setElapsed(e => e + 1), 1000)
      setTimerRef(ref)
    } catch {
      toast.error('Failed to generate questions')
      setPhase('idle')
    }
  }

  function selectAnswer(opt: string) {
    if (phase !== 'question') return
    if (timerRef) clearInterval(timerRef)
    setSelected(opt)
    setPhase('answered')
    setResults(prev => [...prev, { correct: opt === questions[qIndex].correct }])
  }

  function next() {
    if (qIndex + 1 >= questions.length) {
      setPhase('done')
      if (!savedRef.current) {
        savedRef.current = true
        const correct = results.filter(r => r.correct).length
        saveDrillResult({ section: 'gk', topicId: topic.id, subtopicId: subtopic?.id, score: correct, total: results.length })
      }
      return
    }
    setQIndex(i => i + 1)
    setSelected(null)
    setPhase('question')
    setElapsed(0)
    const ref = setInterval(() => setElapsed(e => e + 1), 1000)
    setTimerRef(ref)
  }

  if (phase === 'idle') return (
    <div className="py-8 text-center">
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Practice MCQ questions on this topic</p>
      <button onClick={startDrill} className="px-6 py-2.5 bg-brand-600 text-white text-sm font-medium rounded-xl hover:bg-brand-800 transition-colors active:scale-[0.98]">
        Generate 5 MCQs
      </button>
    </div>
  )

  if (phase === 'loading') return (
    <div className="py-12 text-center">
      <Loader2 size={20} className="animate-spin text-brand-400 mx-auto mb-3" />
      <p className="text-sm text-gray-400">Generating questions…</p>
    </div>
  )

  if (phase === 'done') {
    const correct = results.filter(r => r.correct).length
    return (
      <div className="py-8 text-center">
        <p className="text-4xl font-medium text-gray-900 dark:text-gray-100 tabular-nums">{correct}/{results.length}</p>
        <p className="text-lg text-gray-500 mt-1">{Math.round(correct / results.length * 100)}%</p>
        <div className="flex gap-3 mt-6">
          <button onClick={startDrill} className="flex-1 py-3 bg-brand-600 text-white text-sm font-medium rounded-xl hover:bg-brand-800 transition-colors">Try again</button>
          <button onClick={() => setPhase('idle')} className="flex-1 py-3 border border-gray-200 dark:border-[#30363D] text-gray-600 dark:text-gray-400 text-sm font-medium rounded-xl hover:bg-gray-50 dark:hover:bg-[#1C2128] transition-colors">Back</button>
        </div>
      </div>
    )
  }

  const q = questions[qIndex]
  const opts = ['A', 'B', 'C', 'D'] as const

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-1">
          {questions.map((_, i) => <div key={i} className={cn('w-6 h-1 rounded-full transition-colors', i <= qIndex ? 'bg-brand-400' : 'bg-gray-200 dark:bg-gray-700')} />)}
        </div>
        <div className={cn('flex items-center gap-1 text-xs font-mono tabular-nums', elapsed >= 54 ? 'text-danger-400' : 'text-gray-400')}>
          <Timer size={12} />{Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, '0')}
        </div>
      </div>

      {q && (
        <div className="bg-gray-50 dark:bg-[#1C2128] rounded-xl p-5 mb-5">
          <p className="text-xs text-gray-400 mb-2">Q{qIndex + 1} / {questions.length}</p>
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100 leading-relaxed">{q.question}</p>
        </div>
      )}

      {q && (
        <div className="space-y-2">
          {opts.map(opt => {
            const text = q.options[opt]
            if (!text) return null
            const isCorrect = opt === q.correct
            const isSelected = opt === selected
            return (
              <button key={opt} onClick={() => selectAnswer(opt)} disabled={phase === 'answered'}
                className={cn('w-full flex items-start gap-3 px-4 py-3.5 text-left rounded-xl border-2 text-sm transition-all duration-150',
                  phase === 'answered' && isCorrect && 'bg-success-50 dark:bg-green-900/30 border-success-400 text-success-800 dark:text-green-300',
                  phase === 'answered' && isSelected && !isCorrect && 'bg-danger-50 dark:bg-red-900/30 border-danger-400 text-danger-800 dark:text-red-300',
                  phase === 'question' && 'border-gray-200 dark:border-[#30363D] bg-white dark:bg-[#161B22] hover:border-brand-400 hover:bg-brand-50 dark:hover:bg-brand-900/10 cursor-pointer',
                  phase === 'answered' && !isCorrect && !isSelected && 'border-gray-100 dark:border-gray-800 text-gray-400'
                )}>
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
          <button onClick={next} className="w-full py-3 bg-brand-600 text-white text-sm font-medium rounded-xl hover:bg-brand-800 transition-colors active:scale-[0.98]">
            {qIndex + 1 >= questions.length ? 'See results' : 'Next →'}
          </button>
        </div>
      )}
    </div>
  )
}
