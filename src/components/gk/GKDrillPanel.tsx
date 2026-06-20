'use client'

import { useState, useRef, useEffect } from 'react'
import { Loader2, Timer } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { saveDrillResult } from '@/lib/drill-results'
import { notifyTokens, tokensFromRes } from '@/lib/notify-tokens'
import { fetchSubtopics } from '@/lib/subtopics'
import type { DrillQuestion } from '@/lib/mcq'
import type { Topic } from '@/types/database'

interface SubRef { id: string; name: string }
type Phase = 'setup' | 'loading' | 'question' | 'answered' | 'done'
type Source = 'bank' | 'ai' | 'both'
type Grounding = 'source' | 'note' | 'general'

interface Props {
  topic?: Topic
  subtopic?: SubRef            // fixed subtopic (launched from a subtopic)
  section?: { id: string; name: string } // whole-section ("GK general") drill
}

const COUNTS = [5, 10, 20, 30]
const DIFFS = ['mixed', 'easy', 'medium', 'hard'] as const

export function GKDrillPanel({ topic, subtopic, section }: Props) {
  const [phase, setPhase] = useState<Phase>('setup')
  const [questions, setQuestions] = useState<DrillQuestion[]>([])
  const [qIndex, setQIndex] = useState(0)
  const [selected, setSelected] = useState<string | null>(null)
  const [results, setResults] = useState<{ correct: boolean }[]>([])
  const [elapsed, setElapsed] = useState(0)
  const [timerRef, setTimerRef] = useState<ReturnType<typeof setInterval> | null>(null)
  const savedRef = useRef(false)

  // Setup options
  const [count, setCount] = useState(5)
  const [difficulty, setDifficulty] = useState<typeof DIFFS[number]>('mixed')
  const [source, setSource] = useState<Source>('both')
  const [grounding, setGrounding] = useState<Grounding>('source')
  const [subId, setSubId] = useState<string>(subtopic?.id ?? '')
  const [subOptions, setSubOptions] = useState<SubRef[]>([])

  // Load the topic's subtopics for the selector (topic drill, no fixed subtopic).
  useEffect(() => {
    if (topic && !subtopic) fetchSubtopics(topic.id).then(s => setSubOptions(s.map(x => ({ id: x.id, name: x.name })))).catch(() => {})
  }, [topic, subtopic])

  const effectiveSubId = subtopic?.id ?? (subId || undefined)
  const effectiveSubName = subtopic?.name ?? subOptions.find(s => s.id === subId)?.name

  async function drawBank(want: number): Promise<DrillQuestion[]> {
    const res = await fetch('/api/mcq/draw', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topicId: topic?.id, sectionId: section?.id, subtopicId: effectiveSubId, difficulty, count: want }),
    })
    const json = await res.json().catch(() => ({}))
    return (json.questions ?? []) as DrillQuestion[]
  }

  async function drawAI(want: number): Promise<DrillQuestion[]> {
    const topicName = section ? section.name : effectiveSubName ? `${topic!.name} — ${effectiveSubName}` : topic!.name
    const subsections = effectiveSubName ? [effectiveSubName] : (topic?.subsections ?? [])
    const res = await fetch('/api/ai/generate-mcq', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topicName, subsections, difficulty, count: want, topicId: topic?.id, subtopicId: effectiveSubId, grounding: section ? 'general' : grounding }),
    })
    const json = await res.json().catch(() => ({}))
    notifyTokens(tokensFromRes(res))
    return (json.questions ?? []) as DrillQuestion[]
  }

  async function startDrill() {
    setPhase('loading'); setResults([]); setQIndex(0); setElapsed(0); savedRef.current = false
    try {
      let qs: DrillQuestion[] = []
      if (source === 'bank' || source === 'both') qs = await drawBank(count)
      if (source === 'ai') qs = await drawAI(count)
      else if (source === 'both' && qs.length < count) qs = [...qs, ...await drawAI(count - qs.length)]

      if (qs.length === 0) {
        toast.error(source === 'bank' ? 'No bank questions for this selection yet' : 'No questions generated')
        setPhase('setup'); return
      }
      setQuestions(qs.slice(0, count))
      setPhase('question')
      const ref = setInterval(() => setElapsed(e => e + 1), 1000); setTimerRef(ref)
    } catch {
      toast.error('Failed to load questions'); setPhase('setup')
    }
  }

  function selectAnswer(opt: string) {
    if (phase !== 'question') return
    if (timerRef) clearInterval(timerRef)
    setSelected(opt); setPhase('answered')
    setResults(prev => [...prev, { correct: opt === questions[qIndex].correct }])
  }

  function next() {
    if (qIndex + 1 >= questions.length) {
      setPhase('done')
      if (!savedRef.current) {
        savedRef.current = true
        const correct = results.filter(r => r.correct).length
        saveDrillResult({ section: 'gk', topicId: topic?.id ?? null, subtopicId: effectiveSubId ?? null, score: correct, total: results.length })
      }
      return
    }
    setQIndex(i => i + 1); setSelected(null); setPhase('question'); setElapsed(0)
    const ref = setInterval(() => setElapsed(e => e + 1), 1000); setTimerRef(ref)
  }

  // ── Setup ───────────────────────────────────────────────
  if (phase === 'setup') return (
    <div className="space-y-4 py-2">
      {!subtopic && subOptions.length > 0 && (
        <Field label="Subtopic">
          <select value={subId} onChange={e => setSubId(e.target.value)} className="w-full text-sm border border-gray-200 dark:border-[#30363D] dark:bg-[#1C2128] dark:text-gray-200 rounded-lg px-2 py-2 focus:outline-none">
            <option value="">Whole topic</option>
            {subOptions.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </Field>
      )}

      <Field label="Questions">
        <Segmented options={COUNTS.map(c => ({ value: String(c), label: String(c) }))} value={String(count)} onChange={v => setCount(Number(v))} />
      </Field>

      <Field label="Difficulty">
        <Segmented options={DIFFS.map(d => ({ value: d, label: d[0].toUpperCase() + d.slice(1) }))} value={difficulty} onChange={v => setDifficulty(v as typeof DIFFS[number])} />
      </Field>

      <Field label="Source">
        <Segmented options={[{ value: 'bank', label: 'Bank' }, { value: 'ai', label: 'AI' }, { value: 'both', label: 'Both' }]} value={source} onChange={v => setSource(v as Source)} />
      </Field>

      {(source === 'ai' || source === 'both') && !section && (
        <Field label="AI generates from">
          <Segmented
            options={[{ value: 'source', label: 'Uploaded source' }, { value: 'note', label: 'AI note' }, { value: 'general', label: 'General' }]}
            value={grounding} onChange={v => setGrounding(v as Grounding)}
          />
        </Field>
      )}

      <button onClick={startDrill} className="w-full py-2.5 bg-brand-600 text-white text-sm font-medium rounded-xl hover:bg-brand-800 transition-colors active:scale-[0.98]">
        Start drill
      </button>
    </div>
  )

  if (phase === 'loading') return (
    <div className="py-12 text-center">
      <Loader2 size={20} className="animate-spin text-brand-400 mx-auto mb-3" />
      <p className="text-sm text-gray-400">Loading questions…</p>
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
          <button onClick={() => setPhase('setup')} className="flex-1 py-3 border border-gray-200 dark:border-[#30363D] text-gray-600 dark:text-gray-400 text-sm font-medium rounded-xl hover:bg-gray-50 dark:hover:bg-[#1C2128] transition-colors">New setup</button>
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
            {q.explanation && <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{q.explanation}</p>}
          </div>
          <button onClick={next} className="w-full py-3 bg-brand-600 text-white text-sm font-medium rounded-xl hover:bg-brand-800 transition-colors active:scale-[0.98]">
            {qIndex + 1 >= questions.length ? 'See results' : 'Next →'}
          </button>
        </div>
      )}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wide mb-1.5">{label}</p>
      {children}
    </div>
  )
}

function Segmented({ options, value, onChange }: { options: { value: string; label: string }[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1">
      {options.map(o => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={cn('px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors',
            value === o.value ? 'bg-brand-600 text-white border-brand-600' : 'border-gray-200 dark:border-[#30363D] text-gray-600 dark:text-gray-400 hover:border-gray-300')}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
