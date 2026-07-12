'use client'

import { useState } from 'react'
import { Sparkles, BookOpen, Loader2, Globe } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Markdown } from '@/components/ui/Markdown'
import { readStream } from '@/lib/sse'
import { notifyTokens, tokensFromRes } from '@/lib/notify-tokens'

interface Props {
  content: string
  topicName: string
  /** Optional content shown above the toggle (e.g. an "Official" banner). */
  header?: React.ReactNode
  /** Treat single newlines in the original content as line breaks (for raw pasted text). */
  preserveBreaks?: boolean
  /** Prefix applied to generated heading IDs in the original content. */
  headingIdPrefix?: string
}

type View = 'original' | 'simplified' | 'elaborated'
interface Source { title: string; uri: string }

export function SimplifiableContent({ content, topicName, header, preserveBreaks = false, headingIdPrefix }: Props) {
  const [view, setView] = useState<View>('original')
  const [simplified, setSimplified] = useState<string | null>(null)
  const [elaborated, setElaborated] = useState<string | null>(null)
  const [sources, setSources] = useState<Source[]>([])
  const [elaboratedWeb, setElaboratedWeb] = useState(true)
  const [streamText, setStreamText] = useState('')
  const [simplifying, setSimplifying] = useState(false)
  const [elaborating, setElaborating] = useState(false)

  async function simplify() {
    if (simplified) { setView('simplified'); return }
    setSimplifying(true)
    setStreamText('')
    try {
      const res = await fetch('/api/ai/simplify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: content, topicName }),
      })
      if (!res.ok) throw new Error('Failed')
      setView('simplified')
      const { text: full, tokens } = await readStream(res, setStreamText)
      notifyTokens(tokens)
      setSimplified(full)
    } catch {
      toast.error('Failed to simplify')
      setView('original')
    } finally {
      setSimplifying(false)
    }
  }

  async function elaborate() {
    if (elaborated) { setView('elaborated'); return }
    setElaborating(true)
    try {
      const res = await fetch('/api/ai/elaborate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: content, topicName }),
      })
      const json = await res.json()
      if (!res.ok || !json.text) { toast.error(json.error ?? 'Failed to elaborate'); return }
      notifyTokens(tokensFromRes(res))
      setElaborated(json.text)
      setSources(json.sources ?? [])
      setElaboratedWeb(json.web !== false)
      setView('elaborated')
    } catch {
      toast.error('Failed to elaborate')
    } finally {
      setElaborating(false)
    }
  }

  return (
    <div>
      {header}

      {/* Toggle bar */}
      <div className="flex items-center gap-1 mb-4 bg-gray-100 dark:bg-[#1C2128] rounded-lg p-0.5 w-fit">
        <button
          onClick={() => setView('original')}
          className={cn('flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all', view === 'original' ? 'bg-white dark:bg-[#161B22] text-gray-900 dark:text-gray-100 shadow-sm' : 'text-gray-500 dark:text-gray-400')}
        >
          <BookOpen size={12} /> Original
        </button>
        <button
          onClick={simplify}
          disabled={simplifying || elaborating}
          className={cn('flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all disabled:opacity-50', view === 'simplified' ? 'bg-white dark:bg-[#161B22] text-purple-600 dark:text-purple-400 shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-purple-600')}
        >
          {simplifying ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />} Simplify
        </button>
        <button
          onClick={elaborate}
          disabled={simplifying || elaborating}
          className={cn('flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all disabled:opacity-50', view === 'elaborated' ? 'bg-white dark:bg-[#161B22] text-brand-600 dark:text-brand-400 shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-brand-600')}
        >
          {elaborating ? <Loader2 size={12} className="animate-spin" /> : <Globe size={12} />} Elaborate
        </button>
      </div>

      {view === 'simplified' ? (
        <div>
          {simplifying && !streamText && <p className="text-sm text-gray-400">Simplifying…</p>}
          <Markdown>{simplified ?? streamText}</Markdown>
        </div>
      ) : view === 'elaborated' ? (
        <div>
          {elaborating ? (
            <p className="text-sm text-gray-400">Researching &amp; elaborating from the web…</p>
          ) : (
            <>
              {!elaboratedWeb && (
                <div className="mb-3 px-3 py-2 text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/15 border border-amber-200 dark:border-amber-900/40 rounded-lg">
                  Live web search was unavailable (Gemini quota) — elaborated from AI knowledge instead.
                </div>
              )}
              <Markdown>{elaborated ?? ''}</Markdown>
              {sources.length > 0 && (
                <div className="mt-5 pt-3 border-t border-gray-100 dark:border-[#21262D]">
                  <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wide mb-1.5">Sources</p>
                  <ul className="space-y-1">
                    {sources.map((s, i) => (
                      <li key={i} className="text-xs truncate">
                        <a href={s.uri} target="_blank" rel="noopener noreferrer" className="text-brand-600 hover:text-brand-800 underline underline-offset-2">
                          {s.title || s.uri}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>
      ) : (
        <Markdown preserveBreaks={preserveBreaks} headingIdPrefix={headingIdPrefix}>{content}</Markdown>
      )}
    </div>
  )
}
