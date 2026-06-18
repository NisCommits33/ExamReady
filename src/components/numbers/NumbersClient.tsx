'use client'

import { useState, useMemo } from 'react'
import { Hash, Eye, Loader2, Sparkles, ChevronRight, RotateCcw, List, Zap } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import type { KeyNumber } from '@/types/database'

type Mode = 'list' | 'drill'

interface Props {
  initialNumbers: KeyNumber[]
  extractableTopics: { id: string; name: string }[]
}

export function NumbersClient({ initialNumbers, extractableTopics }: Props) {
  const [numbers, setNumbers] = useState(initialNumbers)
  const [mode, setMode] = useState<Mode>('list')
  const [topicFilter, setTopicFilter] = useState<string>('all')
  const [extracting, setExtracting] = useState(false)

  // Drill state
  const [index, setIndex] = useState(0)
  const [revealed, setRevealed] = useState(false)

  const topicNames = useMemo(() => {
    const set = new Map<string, string>()
    numbers.forEach(n => { const name = n.topics?.name; if (n.topic_id && name) set.set(n.topic_id, name) })
    return [...set.entries()]
  }, [numbers])

  const filtered = useMemo(() =>
    topicFilter === 'all' ? numbers : numbers.filter(n => n.topic_id === topicFilter),
    [numbers, topicFilter])

  async function extractAll() {
    setExtracting(true)
    const toExtract = extractableTopics.filter(t => !numbers.some(n => n.topic_id === t.id))
    if (toExtract.length === 0) { toast.info('All topics already extracted'); setExtracting(false); return }
    let added = 0
    for (const t of toExtract.slice(0, 8)) {
      try {
        const res = await fetch('/api/ai/extract-numbers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ topicId: t.id }) })
        const json = await res.json()
        added += json.count ?? 0
      } catch {}
    }
    // Reload
    const supabase = createClient()
    const { data } = await supabase.from('key_numbers').select('*,topics(name)').order('created_at')
    setNumbers(data ?? [])
    toast.success(`Extracted ${added} key numbers`)
    setExtracting(false)
  }

  function startDrill() {
    if (filtered.length === 0) { toast.error('No numbers to drill'); return }
    setIndex(0); setRevealed(false); setMode('drill')
  }

  function nextCard() {
    if (index + 1 >= filtered.length) { setMode('list'); toast.success('Drill complete'); return }
    setIndex(i => i + 1); setRevealed(false)
  }

  // ── Drill mode ─────────────────────────────────────────────────────────
  if (mode === 'drill') {
    const n = filtered[index]
    return (
      <div>
        <div className="flex items-center justify-between mb-5">
          <button onClick={() => setMode('list')} className="text-xs text-gray-400 hover:text-gray-600 transition-colors">← Back</button>
          <div className="flex items-center gap-1">
            {filtered.map((_, i) => <div key={i} className={cn('w-5 h-1 rounded-full', i <= index ? 'bg-brand-400' : 'bg-gray-200 dark:bg-gray-700')} />)}
          </div>
        </div>

        <p className="text-xs text-gray-400 text-center mb-3">{n.topics?.name ?? 'General'} · {index + 1}/{filtered.length}</p>

        <div className="bg-white dark:bg-[#161B22] border-2 border-brand-200 dark:border-brand-800/50 rounded-2xl p-8 min-h-[200px] flex flex-col items-center justify-center text-center mb-4">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">{n.fact}</p>
          {revealed ? (
            <p className="text-3xl font-bold text-brand-600 dark:text-brand-400 tabular-nums">{n.value}</p>
          ) : (
            <button onClick={() => setRevealed(true)} className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-brand-600 border border-brand-200 dark:border-brand-800 rounded-lg hover:bg-brand-50 dark:hover:bg-brand-900/20 transition-colors">
              <Eye size={14} /> Reveal
            </button>
          )}
        </div>

        <button onClick={nextCard} className="w-full flex items-center justify-center gap-1.5 py-3 bg-brand-600 text-white text-sm font-medium rounded-xl hover:bg-brand-800 transition-colors active:scale-[0.98]">
          {index + 1 >= filtered.length ? 'Finish' : 'Next'} <ChevronRight size={15} />
        </button>
      </div>
    )
  }

  // ── List mode ──────────────────────────────────────────────────────────
  return (
    <div>
      <div className="mb-5">
        <h1 className="text-lg font-medium text-gray-900 dark:text-gray-100">Key Numbers Bank</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Memorize exam-critical figures, dates & thresholds</p>
      </div>

      {numbers.length === 0 ? (
        <div className="py-12 text-center">
          <Hash size={28} className="mx-auto mb-3 text-gray-300" />
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">No key numbers yet</p>
          <p className="text-xs text-gray-400 mb-5">Extract numbers from your study notes to build a memory bank</p>
          <button onClick={extractAll} disabled={extracting} className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-brand-600 text-white text-sm font-medium rounded-xl hover:bg-brand-800 transition-colors disabled:opacity-50">
            {extracting ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            {extracting ? 'Extracting…' : 'Extract from notes'}
          </button>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between gap-2 mb-4">
            <select value={topicFilter} onChange={e => setTopicFilter(e.target.value)} className="text-xs text-gray-600 dark:text-gray-400 bg-transparent border border-gray-200 dark:border-[#30363D] rounded-lg px-2.5 py-1.5 focus:outline-none max-w-[180px] truncate">
              <option value="all">All topics ({numbers.length})</option>
              {topicNames.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
            </select>
            <div className="flex gap-2">
              <button onClick={extractAll} disabled={extracting} className="flex items-center gap-1 text-xs px-2.5 py-1.5 border border-gray-200 dark:border-[#30363D] rounded-lg text-gray-500 hover:text-brand-600 transition-colors disabled:opacity-50">
                {extracting ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />} Extract more
              </button>
              <button onClick={startDrill} className="flex items-center gap-1 text-xs px-3 py-1.5 bg-brand-600 text-white rounded-lg hover:bg-brand-800 transition-colors">
                <Zap size={12} /> Drill
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            {filtered.map(n => (
              <div key={n.id} className="flex items-center justify-between gap-3 px-4 py-3 bg-white dark:bg-[#161B22] border border-gray-200 dark:border-[#30363D] rounded-xl">
                <div className="min-w-0">
                  <p className="text-sm text-gray-700 dark:text-gray-300 truncate">{n.fact}</p>
                  <p className="text-[11px] text-gray-400">{n.topics?.name ?? 'General'}</p>
                </div>
                <span className="text-sm font-bold text-brand-600 dark:text-brand-400 tabular-nums flex-shrink-0">{n.value}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
