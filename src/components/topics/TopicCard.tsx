'use client'

import Link from 'next/link'
import { AlertTriangle } from 'lucide-react'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { PaperBadge } from '@/components/shared/PaperBadge'
import { ProgressBar } from '@/components/shared/ProgressBar'
import { StatusToggle } from '@/components/shared/StatusToggle'
import { cn, relativeDate, coveragePct } from '@/lib/utils'
import type { Topic, TopicStatus } from '@/types/database'

interface TopicCardProps {
  topic: Topic
  onStatusChange: (id: string, status: TopicStatus) => void
}

export function TopicCard({ topic, onStatusChange }: TopicCardProps) {
  const pct = coveragePct(topic.status, topic.mcq_best_score)

  return (
    <Link
      href={`/topics/${topic.id}`}
      className={cn(
        'block bg-white dark:bg-[#161B22] border border-gray-200 dark:border-[#30363D] rounded-xl p-4',
        'transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 active:scale-[0.99] cursor-pointer',
        topic.is_flagged && 'border-l-danger'
      )}
    >
      {/* Top row */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          <PaperBadge paper={topic.paper} section={topic.section} />
          <StatusBadge status={topic.status} />
          {topic.is_flagged && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-purple-50 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300">
              AI rescue
            </span>
          )}
        </div>
        <span className="text-[11px] text-gray-400 flex-shrink-0">P{topic.ai_priority ?? 5}</span>
      </div>

      {/* Topic name */}
      <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-1.5 leading-snug">{topic.name}</p>

      {/* Subsections preview */}
      <p className="text-xs text-gray-400 dark:text-gray-500 mb-2.5 line-clamp-1">
        {topic.subsections.slice(0, 3).join(' · ')}
        {topic.subsections.length > 3 && ` +${topic.subsections.length - 3} more`}
      </p>

      {/* Progress bar */}
      <ProgressBar value={pct} className="mb-3" />

      {topic.is_flagged && (
        <div className="flex items-center gap-1.5 mb-2.5">
          <AlertTriangle size={12} className="text-danger-400 flex-shrink-0" />
          <p className="text-xs text-danger-400 font-medium">Not started · Time critical</p>
        </div>
      )}

      {/* Bottom row */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-3">
          <p className="text-xs text-gray-400">{topic.last_studied ? `Studied ${relativeDate(topic.last_studied)}` : 'Never studied'}</p>
          {topic.mcq_best_score != null && <p className="text-xs text-gray-400">MCQ {topic.mcq_best_score}/5</p>}
        </div>
        {/* Stop propagation so StatusToggle click doesn't navigate */}
        <div onClick={e => e.preventDefault()}>
          <StatusToggle value={topic.status} onChange={s => onStatusChange(topic.id, s)} size="sm" />
        </div>
      </div>
    </Link>
  )
}
