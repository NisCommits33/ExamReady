'use client'

import { useState } from 'react'
import { Globe, Timer, ChevronRight } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { GK_QUESTION_TYPES, GK_CATEGORIES, GK_SUB_TOPICS } from '@/lib/constants'
import type { GKType, GKCategory } from '@/lib/constants'

type Phase = 'categories' | 'subtopics' | 'subsubtopics' | 'config' | 'loading' | 'question' | 'answered' | 'done'

const COUNT_OPTIONS = [5, 10, 15, 20] as const

interface Question {
  question_text: string
  options: Record<string, string>
  correct_answer: string
  explanation: string
  difficulty: string
}

const CATEGORY_STYLES: Record<GKCategory, { card: string; badge: string; activeBadge: string; btn: string }> = {
  nepal:   {
    card:       'border-teal-200 dark:border-teal-800/50 bg-teal-50 dark:bg-teal-900/10 hover:border-teal-400',
    badge:      'bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300',
    activeBadge:'bg-teal-600 text-white',
    btn:        'bg-teal-600 hover:bg-teal-800',
  },
  aviation:{
    card:       'border-brand-200 dark:border-brand-800/50 bg-brand-50 dark:bg-brand-900/10 hover:border-brand-400',
    badge:      'bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300',
    activeBadge:'bg-brand-600 text-white',
    btn:        'bg-brand-600 hover:bg-brand-800',
  },
  world:   {
    card:       'border-purple-200 dark:border-purple-800/50 bg-purple-50 dark:bg-purple-900/10 hover:border-purple-400',
    badge:      'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300',
    activeBadge:'bg-purple-600 text-white',
    btn:        'bg-purple-600 hover:bg-purple-800',
  },
}

interface DrillScope {
  category: GKCategory | null
  subtopicId: GKType | null
  subtopicLabel: string
  subSubtopicId: string | null
  subSubtopicLabel: string | null
  scopeLabel: string     // human-readable description for config screen
  apiScope: string       // passed to API as drill focus
}

const EMPTY_SCOPE: DrillScope = {
  category: null, subtopicId: null, subtopicLabel: '',
  subSubtopicId: null, subSubtopicLabel: null,
  scopeLabel: '', apiScope: '',
}

export function GKClient() {
  const [phase, setPhase] = useState<Phase>('categories')
  const [scope, setScope] = useState<DrillScope>(EMPTY_SCOPE)
  const [count, setCount] = useState<number>(10)
  const [questions, setQuestions] = useState<Question[]>([])
  const [qIndex, setQIndex] = useState(0)
  const [selected, setSelected] = useState<string | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const [timerRef, setTimerRef] = useState<ReturnType<typeof setInterval> | null>(null)
  const [results, setResults] = useState<{ correct: boolean }[]>([])

  // ── Navigation helpers ───────────────────────────────────────────────────

  function pickCategory(cat: GKCategory) {
    setScope({ ...EMPTY_SCOPE, category: cat })
    setPhase('subtopics')
  }

  function pickSubtopic(subtopic: GKType | 'all') {
    const cat = scope.category!
    if (subtopic === 'all') {
      const catInfo = GK_CATEGORIES.find(c => c.id === cat)!
      setScope(s => ({
        ...s,
        subtopicId: null,
        subtopicLabel: `All ${catInfo.label} topics`,
        subSubtopicId: null,
        subSubtopicLabel: null,
        scopeLabel: `All ${catInfo.label} topics`,
        apiScope: `All subtopics in the ${catInfo.label} category: ${GK_QUESTION_TYPES.filter(t => t.category === cat).map(t => t.label).join(', ')}`,
      }))
      setPhase('config')
    } else {
      const info = GK_QUESTION_TYPES.find(t => t.id === subtopic)!
      setScope(s => ({
        ...s,
        subtopicId: subtopic,
        subtopicLabel: info.label,
        subSubtopicId: null,
        subSubtopicLabel: null,
        scopeLabel: info.label,
        apiScope: info.label,
      }))
      setPhase('subsubtopics')
    }
  }

  function pickSubSubtopic(subId: string | 'all') {
    const subtopicId = scope.subtopicId!
    const subList = GK_SUB_TOPICS[subtopicId]
    if (subId === 'all') {
      setScope(s => ({
        ...s,
        subSubtopicId: null,
        subSubtopicLabel: null,
        scopeLabel: s.subtopicLabel,
        apiScope: `${s.subtopicLabel} — covering all sub-areas: ${subList.map(s => s.label).join(', ')}`,
      }))
    } else {
      const info = subList.find(s => s.id === subId)!
      setScope(s => ({
        ...s,
        subSubtopicId: subId,
        subSubtopicLabel: info.label,
        scopeLabel: `${s.subtopicLabel} › ${info.label}`,
        apiScope: `${s.subtopicLabel} — specifically focused on: ${info.label}`,
      }))
    }
    setPhase('config')
  }

  function goRandom() {
    setScope({
      ...EMPTY_SCOPE,
      scopeLabel: 'Random mix — all categories',
      apiScope: 'Random mix across all GK categories: Nepal history, geography, constitution, ICAO, CAAN, aviation history, world affairs, science & tech',
    })
    setPhase('config')
  }

  // ── Drill ────────────────────────────────────────────────────────────────

  async function startDrill() {
    setPhase('loading')
    setResults([])
    setQIndex(0)
    try {
      const res = await fetch('/api/ai/generate-gk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope: scope.apiScope, count }),
      })
      const data = await res.json()
      setQuestions(data.questions ?? [])
      setPhase('question')
      const ref = setInterval(() => setElapsed(e => e + 1), 1000)
      setTimerRef(ref)
    } catch {
      toast.error('Failed to generate questions')
      setPhase('config')
    }
  }

  function selectAnswer(opt: string) {
    if (phase !== 'question') return
    if (timerRef) clearInterval(timerRef)
    setSelected(opt)
    setPhase('answered')
    const q = questions[qIndex]
    setResults(prev => [...prev, { correct: opt === q.correct_answer }])
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
    setPhase('categories')
    setScope(EMPTY_SCOPE)
    setCount(10)
    setQuestions([])
    setQIndex(0)
    setSelected(null)
    setResults([])
    setElapsed(0)
  }

  const style = scope.category ? CATEGORY_STYLES[scope.category] : CATEGORY_STYLES.world

  // ── Phase: categories ────────────────────────────────────────────────────
  if (phase === 'categories') return (
    <div>
      <div className="mb-5">
        <h1 className="text-lg font-medium text-gray-900 dark:text-gray-100">General Knowledge</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Nepal · Aviation · World affairs</p>
      </div>

      <div className="space-y-2.5 mb-4">
        {GK_CATEGORIES.map(cat => {
          const s = CATEGORY_STYLES[cat.id]
          const subtopicCount = GK_QUESTION_TYPES.filter(t => t.category === cat.id).length
          return (
            <button
              key={cat.id}
              onClick={() => pickCategory(cat.id)}
              className={cn('w-full flex items-center gap-4 p-4 rounded-xl border-2 text-left transition-all duration-150 active:scale-[0.99]', s.card)}
            >
              <span className="text-2xl flex-shrink-0">{cat.emoji}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{cat.label}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{cat.description}</p>
              </div>
              <span className={cn('text-[11px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0', s.badge)}>
                {subtopicCount} topics
              </span>
            </button>
          )
        })}
      </div>

      <button
        onClick={goRandom}
        className="w-full py-3.5 bg-gray-800 dark:bg-gray-700 text-white text-sm font-medium rounded-xl hover:bg-gray-900 dark:hover:bg-gray-600 transition-colors active:scale-[0.98]"
      >
        🎲 Random mix — all categories
      </button>
    </div>
  )

  // ── Phase: subtopics ─────────────────────────────────────────────────────
  if (phase === 'subtopics' && scope.category) {
    const cat = GK_CATEGORIES.find(c => c.id === scope.category)!
    const subtopics = GK_QUESTION_TYPES.filter(t => t.category === scope.category)

    return (
      <div>
        <button onClick={() => setPhase('categories')} className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 mb-5 transition-colors">
          ← Categories
        </button>
        <div className="flex items-center gap-3 mb-5">
          <span className="text-2xl">{cat.emoji}</span>
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">{cat.label}</h2>
        </div>

        <button
          onClick={() => pickSubtopic('all')}
          className={cn('w-full flex items-center justify-between px-4 py-3.5 rounded-xl border-2 mb-4 transition-all active:scale-[0.98]', style.card)}
        >
          <div className="text-left">
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">All {cat.label} topics</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Mix across all {subtopics.length} subtopics</p>
          </div>
          <ChevronRight size={16} className="text-gray-400" />
        </button>

        <p className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-2 px-1">Choose a subtopic</p>
        <div className="space-y-2">
          {subtopics.map(t => {
            const subCount = GK_SUB_TOPICS[t.id as GKType]?.length ?? 0
            return (
              <button
                key={t.id}
                onClick={() => pickSubtopic(t.id as GKType)}
                className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-gray-200 dark:border-[#30363D] bg-white dark:bg-[#161B22] hover:border-brand-400 dark:hover:border-brand-700 transition-all active:scale-[0.98] text-left"
              >
                <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{t.label}</p>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400 dark:text-gray-500">{subCount} sub-topics</span>
                  <ChevronRight size={14} className="text-gray-400" />
                </div>
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  // ── Phase: sub-subtopics ─────────────────────────────────────────────────
  if (phase === 'subsubtopics' && scope.subtopicId) {
    const subList = GK_SUB_TOPICS[scope.subtopicId]

    return (
      <div>
        <button onClick={() => setPhase('subtopics')} className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 mb-5 transition-colors">
          ← {scope.subtopicLabel.split(' ')[0]} topics
        </button>
        <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-1">{scope.subtopicLabel}</h2>
        <p className="text-xs text-gray-400 dark:text-gray-500 mb-5">{subList.length} sub-topics available</p>

        <button
          onClick={() => pickSubSubtopic('all')}
          className={cn('w-full flex items-center justify-between px-4 py-3.5 rounded-xl border-2 mb-4 transition-all active:scale-[0.98]', style.card)}
        >
          <div className="text-left">
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">All {scope.subtopicLabel} areas</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Questions from all {subList.length} sub-topics</p>
          </div>
          <ChevronRight size={16} className="text-gray-400" />
        </button>

        <p className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-2 px-1">Choose a sub-topic</p>
        <div className="space-y-2">
          {subList.map(sub => (
            <button
              key={sub.id}
              onClick={() => pickSubSubtopic(sub.id)}
              className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-gray-200 dark:border-[#30363D] bg-white dark:bg-[#161B22] hover:border-brand-400 dark:hover:border-brand-700 transition-all active:scale-[0.98] text-left"
            >
              <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{sub.label}</p>
              <ChevronRight size={14} className="text-gray-400" />
            </button>
          ))}
        </div>
      </div>
    )
  }

  // ── Phase: config ────────────────────────────────────────────────────────
  if (phase === 'config') {
    const isRandom = !scope.category
    const backPhase: Phase = scope.subSubtopicId || scope.subtopicId
      ? (scope.subSubtopicId ? 'subsubtopics' : 'subtopics')
      : isRandom ? 'categories' : 'subtopics'

    return (
      <div>
        <button onClick={() => setPhase(backPhase)} className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 mb-5 transition-colors">
          ← Back
        </button>

        <div className="bg-white dark:bg-[#161B22] border border-gray-200 dark:border-[#30363D] rounded-xl p-5 mb-6">
          {scope.category && (
            <span className="text-lg mr-1">{GK_CATEGORIES.find(c => c.id === scope.category)?.emoji}</span>
          )}
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mt-1">{scope.scopeLabel}</h2>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
            {isRandom
              ? 'Questions from all 8 GK subtopics'
              : scope.subSubtopicId
                ? `Focused drill: ${scope.subSubtopicLabel}`
                : scope.subtopicId
                  ? `All sub-topics within ${scope.subtopicLabel}`
                  : `All subtopics in this category`}
          </p>
        </div>

        <div className="mb-6">
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">How many questions?</p>
          <div className="grid grid-cols-4 gap-2">
            {COUNT_OPTIONS.map(n => (
              <button
                key={n}
                onClick={() => setCount(n)}
                className={cn(
                  'py-3 rounded-xl text-sm font-semibold border-2 transition-all duration-150 active:scale-[0.97]',
                  count === n
                    ? 'bg-brand-600 text-white border-brand-600'
                    : 'bg-white dark:bg-[#161B22] text-gray-700 dark:text-gray-300 border-gray-200 dark:border-[#30363D] hover:border-brand-400'
                )}
              >
                {n}
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
            Est. {Math.ceil(count * 1.2)} min · no negative marking
          </p>
        </div>

        <button
          onClick={startDrill}
          className={cn('w-full py-3.5 text-white text-sm font-medium rounded-xl transition-colors active:scale-[0.98]',
            isRandom ? 'bg-gray-800 hover:bg-gray-900' : style.btn
          )}
        >
          Start {count} questions →
        </button>
      </div>
    )
  }

  // ── Phase: loading ───────────────────────────────────────────────────────
  if (phase === 'loading') return (
    <div className="py-20 text-center">
      <div className="w-6 h-6 border-2 border-gray-200 border-t-brand-600 rounded-full animate-spin mx-auto mb-3" />
      <p className="text-sm text-gray-400">Generating {count} questions…</p>
      <p className="text-xs text-gray-400 dark:text-gray-600 mt-1">{scope.scopeLabel}</p>
    </div>
  )

  // ── Phase: done ──────────────────────────────────────────────────────────
  if (phase === 'done') {
    const correct = results.filter(r => r.correct).length
    const pct = Math.round(correct / results.length * 100)
    return (
      <div className="py-8 text-center">
        <Globe size={32} className="mx-auto mb-3 text-brand-400" />
        <p className="text-4xl font-medium text-gray-900 dark:text-gray-100 tabular-nums">{correct}/{results.length}</p>
        <p className={cn('text-lg mt-1', pct >= 70 ? 'text-success-400' : pct >= 50 ? 'text-warning-400' : 'text-danger-400')}>
          {pct}%
        </p>
        <p className="text-sm text-gray-400 dark:text-gray-500 mt-1 mb-1 font-medium">{scope.scopeLabel}</p>
        <p className="text-xs text-gray-400 dark:text-gray-600 mb-6">
          {pct >= 70 ? 'Great work!' : pct >= 50 ? 'Getting there — drill again' : 'Keep practising this area'}
        </p>
        <div className="flex gap-3">
          <button onClick={() => setPhase('config')} className="flex-1 py-3 bg-brand-600 text-white text-sm font-medium rounded-xl hover:bg-brand-800 transition-colors">
            Try again
          </button>
          <button onClick={reset} className="flex-1 py-3 border border-gray-200 dark:border-[#30363D] text-gray-600 dark:text-gray-400 text-sm font-medium rounded-xl hover:bg-gray-50 dark:hover:bg-[#1C2128] transition-colors">
            Back to menu
          </button>
        </div>
      </div>
    )
  }

  // ── Phase: question / answered ───────────────────────────────────────────
  const q = questions[qIndex]
  const opts = ['A', 'B', 'C', 'D'] as const
  const overTime = elapsed >= 60

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-1">
          {questions.map((_, i) => (
            <div key={i} className={cn('w-6 h-1 rounded-full transition-colors',
              i < qIndex ? 'bg-brand-400' : i === qIndex ? 'bg-brand-600' : 'bg-gray-200 dark:bg-gray-700')} />
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

      {q && (
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
                  phase === 'question' && 'border-gray-200 dark:border-[#30363D] bg-white dark:bg-[#161B22] hover:border-brand-400 hover:bg-brand-50 dark:hover:bg-brand-900/20 cursor-pointer',
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
          <button onClick={next} className="w-full py-3 bg-brand-600 text-white text-sm font-medium rounded-xl hover:bg-brand-800 transition-colors active:scale-[0.98]">
            {qIndex + 1 >= questions.length ? 'See results' : 'Next →'}
          </button>
        </div>
      )}
    </div>
  )
}
