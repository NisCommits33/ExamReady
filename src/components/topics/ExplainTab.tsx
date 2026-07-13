'use client'

import { useEffect, useState } from 'react'
import { Loader2, Mic, MicOff, Lightbulb, AlertTriangle, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { notifyTokens, tokensFromRes } from '@/lib/notify-tokens'
import { seedWeakCards } from '@/lib/review-cards'
import { recordStudyEvent } from '@/lib/study-events'
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition'
import type { Topic, Explanation } from '@/types/database'

interface Result {
  clarity_score: number
  jargon: string[]
  gaps: string[]
  analogy_suggestions: string[]
  simpler_rewrite: string
}

export function ExplainTab({ topic, keyPoints }: { topic: Topic; keyPoints: string | null }) {
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<Result | null>(null)
  const [history, setHistory] = useState<Explanation[]>([])
  const { supported, listening, toggle } = useSpeechRecognition(t => setText(prev => (prev ? `${prev} ${t}` : t)))

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data } = await supabase
        .from('explanations').select('*').eq('topic_id', topic.id)
        .order('created_at', { ascending: false }).limit(5)
      setHistory(data ?? [])
    }
    load()
  }, [topic.id])

  const bestScore = history.reduce((m, h) => Math.max(m, h.clarity_score ?? 0), result?.clarity_score ?? 0)

  async function submit() {
    if (text.trim().length < 20) { toast.error('Write a bit more to get useful feedback'); return }
    setLoading(true)
    try {
      const res = await fetch('/api/ai/evaluate-explanation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topicName: topic.name, explanation: text, keyPoints }),
      })
      if (!res.ok) throw new Error('failed')
      notifyTokens(tokensFromRes(res))
      const data: Result = await res.json()
      setResult(data)

      const supabase = createClient()
      const { data: saved } = await supabase.from('explanations').insert({
        topic_id: topic.id,
        text: text.trim(),
        clarity_score: data.clarity_score,
        jargon: data.jargon ?? [],
        gaps: data.gaps ?? [],
      }).select().single()
      if (saved) setHistory(prev => [saved, ...prev].slice(0, 5))

      // Feed each knowledge gap back into the spaced-repetition queue.
      if (data.gaps?.length) await seedWeakCards(topic.id, data.gaps, 'feynman_gap')
      void recordStudyEvent({
        topicId: topic.id,
        eventType: 'practice',
        source: 'practice',
        metadata: {
          activity: 'feynman',
          correct: data.clarity_score ?? 0,
          total: 10,
          scorePct: Math.round((data.clarity_score ?? 0) * 10),
          gaps: data.gaps?.length ?? 0,
        },
      })
      toast.success(`Clarity ${data.clarity_score}/10${data.gaps?.length ? ` · ${data.gaps.length} gap card${data.gaps.length > 1 ? 's' : ''} added to review` : ''}`)
    } catch {
      toast.error('Could not evaluate your explanation')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <div className="mb-4 px-3 py-2.5 bg-amber-50 dark:bg-amber-900/15 border border-amber-200 dark:border-amber-800/50 rounded-lg">
        <p className="text-sm font-medium text-amber-900 dark:text-amber-200 flex items-center gap-1.5"><Lightbulb size={14} /> Feynman technique</p>
        <p className="text-xs text-amber-700 dark:text-amber-300/80 mt-0.5">Explain <span className="font-medium">{topic.name}</span> as if teaching a 12-year-old — no jargon. If you get stuck, that&apos;s the gap to study.</p>
      </div>

      <div className="relative">
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          rows={8}
          placeholder="In your own simple words, explain this topic…"
          className="w-full text-sm text-gray-700 dark:text-gray-100 dark:bg-transparent border border-gray-200 dark:border-[#30363D] rounded-lg p-3 resize-y focus:outline-none focus:ring-2 focus:ring-amber-400/30 focus:border-amber-400"
        />
        {supported && (
          <button
            onClick={toggle}
            className={cn('absolute bottom-3 right-3 flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border transition-colors',
              listening ? 'border-danger-400 text-danger-600 bg-danger-50 dark:bg-danger-900/20 animate-pulse' : 'border-gray-200 dark:border-[#30363D] text-gray-500')}
          >
            {listening ? <MicOff size={13} /> : <Mic size={13} />}{listening ? 'Stop' : 'Speak'}
          </button>
        )}
      </div>

      <div className="flex items-center justify-between mt-3">
        <span className="text-xs text-gray-400">{bestScore > 0 ? `Best clarity: ${bestScore}/10` : 'No attempts yet'}</span>
        <button
          onClick={submit}
          disabled={loading}
          className="flex items-center gap-1.5 px-4 py-2 bg-amber-600 text-white text-sm font-medium rounded-lg hover:bg-amber-700 transition-colors disabled:opacity-50"
        >
          {loading && <Loader2 size={14} className="animate-spin" />} Check my explanation
        </button>
      </div>

      {result && (
        <div className="mt-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="text-2xl font-semibold text-gray-900 dark:text-gray-100">{result.clarity_score}<span className="text-sm text-gray-400">/10</span></div>
            <div className="flex-1 h-2 bg-gray-100 dark:bg-[#30363D] rounded-full overflow-hidden">
              <div className="h-full bg-amber-500" style={{ width: `${result.clarity_score * 10}%` }} />
            </div>
          </div>

          {result.gaps?.length > 0 && (
            <Section title="Knowledge gaps" icon={<AlertTriangle size={13} className="text-danger-500" />} items={result.gaps} note="Added to your review queue" />
          )}
          {result.jargon?.length > 0 && (
            <Section title="Jargon to simplify" icon={<Sparkles size={13} className="text-brand-500" />} items={result.jargon} />
          )}
          {result.analogy_suggestions?.length > 0 && (
            <Section title="Analogies to try" icon={<Lightbulb size={13} className="text-amber-500" />} items={result.analogy_suggestions} />
          )}
          {result.simpler_rewrite && (
            <div className="border border-gray-200 dark:border-[#30363D] rounded-lg p-3">
              <p className="text-xs font-medium text-gray-500 mb-1">Model explanation</p>
              <p className="text-sm text-gray-700 dark:text-gray-200 leading-relaxed">{result.simpler_rewrite}</p>
            </div>
          )}
        </div>
      )}

      {history.length > 0 && (
        <div className="mt-8 pt-4 border-t border-gray-100 dark:border-[#30363D]">
          <p className="text-xs font-medium text-gray-500 mb-2">Past attempts</p>
          <div className="space-y-1.5">
            {history.map(h => (
              <div key={h.id} className="flex items-center justify-between text-xs">
                <span className="text-gray-500 truncate max-w-[70%]">{h.text.slice(0, 60)}…</span>
                <span className="text-amber-600 dark:text-amber-400 font-medium">{h.clarity_score ?? '—'}/10</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function Section({ title, icon, items, note }: { title: string; icon: React.ReactNode; items: string[]; note?: string }) {
  return (
    <div>
      <p className="text-xs font-medium text-gray-500 mb-1.5 flex items-center gap-1.5">{icon}{title}{note && <span className="text-[10px] text-gray-400 font-normal">· {note}</span>}</p>
      <ul className="space-y-1">
        {items.map((it, i) => (
          <li key={i} className="text-sm text-gray-700 dark:text-gray-200 flex gap-2"><span className="text-gray-300">•</span>{it}</li>
        ))}
      </ul>
    </div>
  )
}
