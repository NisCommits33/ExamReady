'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronDown, ChevronUp, Loader2, Sparkles, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { formatDate } from '@/lib/utils'
import { Markdown } from '@/components/ui/Markdown'
import type { WeeklyReport } from '@/types/database'

export function WeeklyReviewSection({ report }: { report: WeeklyReport | null }) {
  const router = useRouter()
  const [expanded, setExpanded] = useState(false)
  const [generating, setGenerating] = useState(false)

  async function generate() {
    setGenerating(true)
    try {
      const res = await fetch('/api/ai/weekly-report', { method: 'POST' })
      const json = await res.json()
      if (json.ok) {
        toast.success('Weekly review generated')
        router.refresh()
      } else {
        toast.error('Failed to generate review')
      }
    } catch {
      toast.error('Failed to generate review')
    } finally {
      setGenerating(false)
    }
  }

  if (!report) {
    return (
      <div className="bg-white dark:bg-[#161B22] border border-gray-200 dark:border-[#30363D] rounded-xl p-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <Sparkles size={15} className="text-purple-500 flex-shrink-0" />
          <p className="text-sm text-gray-600 dark:text-gray-400 truncate">No weekly review yet</p>
        </div>
        <button
          onClick={generate}
          disabled={generating}
          className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-purple-500 rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50"
        >
          {generating ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
          Generate review
        </button>
      </div>
    )
  }

  const preview = report.content.split('\n').find(Boolean) ?? ''

  return (
    <div className="bg-white dark:bg-[#161B22] border border-gray-200 dark:border-[#30363D] rounded-xl p-4">
      <div className="flex items-center gap-2">
        <span className="text-[11px] font-semibold text-purple-800 bg-purple-50 px-2 py-0.5 rounded-full uppercase tracking-wide">AI</span>
        <p className="text-sm font-medium text-gray-900 dark:text-gray-100 flex-1 cursor-pointer" onClick={() => setExpanded(e => !e)}>
          Week of {formatDate(report.week_start)}
        </p>
        <button onClick={generate} disabled={generating} className="text-gray-400 hover:text-purple-500 transition-colors disabled:opacity-50" title="Regenerate">
          {generating ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
        </button>
        <button onClick={() => setExpanded(e => !e)} className="text-gray-400">
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
      </div>

      {!expanded && <p className="text-sm text-gray-500 mt-2 line-clamp-1">{preview}</p>}
      {expanded && <div className="mt-3"><Markdown compact>{report.content}</Markdown></div>}
    </div>
  )
}
