import { cn } from '@/lib/utils'

interface ProgressBarProps {
  value: number        // 0–100
  color?: string       // Tailwind bg class
  className?: string
  showLabel?: boolean
}

export function ProgressBar({ value, color, className, showLabel }: ProgressBarProps) {
  const pct = Math.min(100, Math.max(0, value))
  const fillColor = color ?? (pct >= 70 ? 'bg-success-400' : pct >= 40 ? 'bg-warning-400' : 'bg-danger-400')

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div className="flex-1 h-1 rounded-full bg-gray-200 overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all duration-500', fillColor)}
          style={{ width: `${pct}%` }}
        />
      </div>
      {showLabel && (
        <span className="text-xs text-gray-400 tabular-nums w-8 text-right">{pct}%</span>
      )}
    </div>
  )
}
