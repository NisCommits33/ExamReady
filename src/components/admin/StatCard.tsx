import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

export function StatCard({ label, value, hint, Icon, tint = 'text-brand-500' }: {
  label: string
  value: string
  hint?: string
  Icon?: LucideIcon
  tint?: string
}) {
  return (
    <div className="bg-white dark:bg-[#161B22] border border-gray-200 dark:border-[#30363D] rounded-xl p-4">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wide">{label}</p>
        {Icon && <Icon size={15} className={cn('flex-shrink-0', tint)} aria-hidden="true" />}
      </div>
      <p className="text-2xl font-semibold text-gray-900 dark:text-gray-100 tabular-nums leading-none mt-2">{value}</p>
      {hint && <p className="text-[11px] text-gray-400 mt-1.5">{hint}</p>}
    </div>
  )
}
