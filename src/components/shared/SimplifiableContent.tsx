'use client'

import { useState } from 'react'
import { Sparkles, BookOpen, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Markdown } from '@/components/ui/Markdown'

interface Props {
  content: string
  topicName: string
  /** Optional content shown above the toggle (e.g. an "Official" banner). */
  header?: React.ReactNode
}

export function SimplifiableContent({ content, topicName, header }: Props) {
  const [simplified, setSimplified] = useState<string | null>(null)
  const [showSimplified, setShowSimplified] = useState(false)
  const [loading, setLoading] = useState(false)
  const [streamText, setStreamText] = useState('')

  async function simplify() {
    if (simplified) { setShowSimplified(true); return }
    setLoading(true)
    setStreamText('')
    try {
      const res = await fetch('/api/ai/simplify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: content, topicName }),
      })
      if (!res.ok) throw new Error('Failed')
      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let full = ''
      setShowSimplified(true)
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        for (const line of decoder.decode(value).split('\n')) {
          if (line.startsWith('data: ')) {
            const d = line.slice(6)
            if (d === '[DONE]') break
            try { full += JSON.parse(d).choices?.[0]?.delta?.content ?? ''; setStreamText(full) } catch {}
          }
        }
      }
      setSimplified(full)
    } catch {
      toast.error('Failed to simplify')
      setShowSimplified(false)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      {header}

      {/* Toggle bar */}
      <div className="flex items-center gap-1 mb-4 bg-gray-100 dark:bg-[#1C2128] rounded-lg p-0.5 w-fit">
        <button
          onClick={() => setShowSimplified(false)}
          className={cn('flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all', !showSimplified ? 'bg-white dark:bg-[#161B22] text-gray-900 dark:text-gray-100 shadow-sm' : 'text-gray-500 dark:text-gray-400')}
        >
          <BookOpen size={12} /> Original
        </button>
        <button
          onClick={simplify}
          disabled={loading}
          className={cn('flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all', showSimplified ? 'bg-white dark:bg-[#161B22] text-purple-600 dark:text-purple-400 shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-purple-600')}
        >
          {loading ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />} Simplify
        </button>
      </div>

      {showSimplified ? (
        <div>
          {loading && !streamText && <p className="text-sm text-gray-400">Simplifying…</p>}
          <Markdown>{simplified ?? streamText}</Markdown>
        </div>
      ) : (
        <Markdown>{content}</Markdown>
      )}
    </div>
  )
}
