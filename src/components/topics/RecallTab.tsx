'use client'

import { useState } from 'react'
import { Loader2, Check, X, Eye } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Markdown } from '@/components/ui/Markdown'
import { notifyTokens, tokensFromRes } from '@/lib/notify-tokens'
import { seedWeakCards, gradeTopicFromScore } from '@/lib/review-cards'
import { recordStudyEvent } from '@/lib/study-events'
import type { Topic } from '@/types/database'

interface Result {
  covered: string[]
  missed: string[]
  wrong: string[]
  score_pct: number
}

export function RecallTab({ topic, keyPoints }: { topic: Topic; keyPoints: string | null }) {
  const [text, setText] = useState('')
  const [phase, setPhase] = useState<'writing' | 'revealed'>('writing')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<Result | null>(null)

  async function checkRecall() {
    if (text.trim().length < 15) { toast.error('Write what you remember first'); return }
    setLoading(true)
    setPhase('revealed')
    try {
      const res = await fetch('/api/ai/check-recall', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topicName: topic.name, recall: text, keyPoints }),
      })
      if (!res.ok) throw new Error('failed')
      notifyTokens(tokensFromRes(res))
      const data: Result = await res.json()
      setResult(data)

      // Missed/wrong points become due review cards; the topic itself is graded from the score.
      const weak = [...(data.missed ?? []), ...(data.wrong ?? [])]
      if (weak.length) await seedWeakCards(topic.id, weak, 'recall_miss')
      await gradeTopicFromScore(topic.id, topic.name, data.score_pct ?? 0)
      void recordStudyEvent({
        topicId: topic.id,
        eventType: 'practice',
        source: 'practice',
        metadata: {
          activity: 'active_recall',
          correct: data.score_pct ?? 0,
          total: 100,
          scorePct: data.score_pct ?? 0,
          missed: weak.length,
        },
      })
      toast.success(`Recalled ~${data.score_pct ?? 0}%${weak.length ? ` · ${weak.length} card${weak.length > 1 ? 's' : ''} added to review` : ''}`)
    } catch {
      toast.error('Could not check your recall')
    } finally {
      setLoading(false)
    }
  }

  function reset() { setText(''); setPhase('writing'); setResult(null) }

  return (
    <div>
      <div className="mb-4 px-3 py-2.5 bg-teal-50 dark:bg-teal-900/15 border border-teal-200 dark:border-teal-800/50 rounded-lg">
        <p className="text-sm font-medium text-teal-900 dark:text-teal-200 flex items-center gap-1.5"><Eye size={14} /> Active recall</p>
        <p className="text-xs text-teal-700 dark:text-teal-300/80 mt-0.5">Close the notes. Write everything you remember about <span className="font-medium">{topic.name}</span> — then check yourself.</p>
      </div>

      {phase === 'writing' ? (
        <>
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            rows={10}
            placeholder="From memory, write down every fact, number, and idea you can recall…"
            className="w-full text-sm text-gray-700 dark:text-gray-100 dark:bg-transparent border border-gray-200 dark:border-[#30363D] rounded-lg p-3 resize-y focus:outline-none focus:ring-2 focus:ring-teal-400/30 focus:border-teal-400"
          />
          <div className="flex justify-end mt-3">
            <button
              onClick={checkRecall}
              disabled={loading}
              className="flex items-center gap-1.5 px-4 py-2 bg-teal-600 text-white text-sm font-medium rounded-lg hover:bg-teal-700 transition-colors disabled:opacity-50"
            >
              {loading && <Loader2 size={14} className="animate-spin" />} Reveal &amp; check
            </button>
          </div>
        </>
      ) : (
        <div className="space-y-5">
          {loading ? (
            <div className="py-8 text-center">
              <Loader2 size={20} className="animate-spin mx-auto text-teal-500 mb-2" />
              <p className="text-sm text-gray-400">Comparing your recall to the key points…</p>
            </div>
          ) : result && (
            <>
              <div className="flex items-center gap-3">
                <div className="text-2xl font-semibold text-gray-900 dark:text-gray-100">{result.score_pct}%</div>
                <div className="flex-1 h-2 bg-gray-100 dark:bg-[#30363D] rounded-full overflow-hidden">
                  <div className="h-full bg-teal-500" style={{ width: `${result.score_pct}%` }} />
                </div>
              </div>
              {result.covered?.length > 0 && <RecallList title="You remembered" items={result.covered} tone="good" />}
              {result.missed?.length > 0 && <RecallList title="You missed" items={result.missed} tone="miss" note="Added to review" />}
              {result.wrong?.length > 0 && <RecallList title="Got mixed up" items={result.wrong} tone="wrong" note="Added to review" />}
            </>
          )}

          {/* Reference key points revealed */}
          <div className="pt-2 border-t border-gray-100 dark:border-[#30363D]">
            <p className="text-xs font-medium text-gray-500 mb-2">Reference key points</p>
            {keyPoints ? <Markdown>{keyPoints}</Markdown> : <p className="text-xs text-gray-400">Generate the study note to populate key points.</p>}
          </div>

          <div className="flex justify-end">
            <button onClick={reset} className="text-sm text-teal-600 dark:text-teal-400 font-medium hover:underline">Try again</button>
          </div>
        </div>
      )}
    </div>
  )
}

function RecallList({ title, items, tone, note }: { title: string; items: string[]; tone: 'good' | 'miss' | 'wrong'; note?: string }) {
  const Icon = tone === 'good' ? Check : X
  const color = tone === 'good' ? 'text-success-500' : tone === 'miss' ? 'text-warning-500' : 'text-danger-500'
  return (
    <div>
      <p className="text-xs font-medium text-gray-500 mb-1.5">{title}{note && <span className="text-[10px] text-gray-400 font-normal"> · {note}</span>}</p>
      <ul className="space-y-1">
        {items.map((it, i) => (
          <li key={i} className="text-sm text-gray-700 dark:text-gray-200 flex gap-2"><Icon size={14} className={cn('mt-0.5 flex-shrink-0', color)} />{it}</li>
        ))}
      </ul>
    </div>
  )
}
