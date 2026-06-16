import { cn } from '@/lib/utils'
import type { TopicStatus } from '@/types/database'

const CONFIG: Record<TopicStatus, { bg: string; text: string; label: string }> = {
  not_started: { bg: 'bg-gray-100 dark:bg-gray-800',    text: 'text-gray-600 dark:text-gray-300',   label: 'Not started' },
  in_progress: { bg: 'bg-warning-50',                   text: 'text-warning-800',                   label: 'In progress' },
  done:        { bg: 'bg-success-50',                   text: 'text-success-800',                   label: 'Done'        },
}

export function StatusBadge({ status, className }: { status: TopicStatus; className?: string }) {
  const c = CONFIG[status]
  return (
    <span className={cn(
      'inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium',
      c.bg, c.text, className
    )}>
      {c.label}
    </span>
  )
}
