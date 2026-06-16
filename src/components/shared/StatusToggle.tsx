'use client'

import { cn } from '@/lib/utils'
import type { TopicStatus } from '@/types/database'

const OPTIONS: { value: TopicStatus; label: string }[] = [
  { value: 'not_started', label: 'Not started' },
  { value: 'in_progress', label: 'Doing'       },
  { value: 'done',        label: 'Done'         },
]

interface StatusToggleProps {
  value: TopicStatus
  onChange: (s: TopicStatus) => void
  disabled?: boolean
  size?: 'sm' | 'md'
}

export function StatusToggle({ value, onChange, disabled, size = 'md' }: StatusToggleProps) {
  return (
    <div className={cn(
      'inline-flex items-center bg-gray-100 dark:bg-[#1C2128] rounded-lg p-0.5 gap-0.5',
      disabled && 'opacity-50 pointer-events-none'
    )}>
      {OPTIONS.map(opt => {
        const active = opt.value === value
        return (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={cn(
              'rounded-md font-medium transition-all duration-150',
              size === 'sm' ? 'text-[11px] px-2 py-1' : 'text-xs px-2.5 py-1.5',
              active
                ? 'bg-white dark:bg-[#30363D] text-gray-900 dark:text-gray-100 shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            )}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}
