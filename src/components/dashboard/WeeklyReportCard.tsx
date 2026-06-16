'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import type { WeeklyReport } from '@/types/database'
import { formatDate } from '@/lib/utils'
import { Markdown } from '@/components/ui/Markdown'

export function WeeklyReportCard({ report }: { report: WeeklyReport }) {
  const [expanded, setExpanded] = useState(false)
  const preview = report.content.split('\n').find(Boolean) ?? ''

  return (
    <div className="bg-white dark:bg-[#161B22] border border-gray-200 dark:border-[#30363D] rounded-xl p-4">
      <div
        className="flex items-center gap-2 cursor-pointer select-none"
        onClick={() => setExpanded(e => !e)}
      >
        <span className="text-[11px] font-semibold text-purple-800 bg-purple-50 px-2 py-0.5 rounded-full uppercase tracking-wide">AI</span>
        <p className="text-sm font-medium text-gray-900 dark:text-gray-100 flex-1">
          Week of {formatDate(report.week_start)}
        </p>
        {expanded ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
      </div>

      {!expanded && (
        <p className="text-sm text-gray-500 mt-2 line-clamp-1">{preview}</p>
      )}

      {expanded && (
        <div className="mt-3">
          <Markdown compact>{report.content}</Markdown>
        </div>
      )}
    </div>
  )
}
