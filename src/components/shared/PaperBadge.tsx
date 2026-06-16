import { cn } from '@/lib/utils'

interface PaperBadgeProps {
  paper: 1 | 2
  section?: string
  className?: string
}

export function PaperBadge({ paper, section, className }: PaperBadgeProps) {
  const isP2 = paper === 2
  return (
    <span className={cn(
      'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium',
      isP2 ? 'bg-teal-50 text-teal-800' : 'bg-brand-50 text-brand-800',
      className
    )}>
      P{paper}{section ? ` · §${section}` : ''}
    </span>
  )
}
