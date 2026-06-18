'use client'

import { Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { TopicStatus } from '@/types/database'

export type StatusFilter = 'all' | TopicStatus
export type SortKey = 'default' | 'status' | 'score' | 'last_attempted'

interface Props {
  search: string
  onSearchChange: (v: string) => void
  statusFilter: StatusFilter
  onStatusFilterChange: (v: StatusFilter) => void
  sortBy: SortKey
  onSortChange: (v: SortKey) => void
}

const FILTERS: { key: StatusFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'not_started', label: 'Not started' },
  { key: 'in_progress', label: 'In progress' },
  { key: 'done', label: 'Done' },
]

const SORTS: { key: SortKey; label: string }[] = [
  { key: 'default', label: 'Default' },
  { key: 'score', label: 'Score' },
  { key: 'status', label: 'Status' },
  { key: 'last_attempted', label: 'Recent' },
]

export function StudySearchFilter({ search, onSearchChange, statusFilter, onStatusFilterChange, sortBy, onSortChange }: Props) {
  return (
    <div className="mb-4 space-y-3">
      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Search topics…"
          value={search}
          onChange={e => onSearchChange(e.target.value)}
          className="w-full pl-9 pr-3 py-2.5 text-sm border border-gray-200 dark:border-[#30363D] dark:bg-[#1C2128] dark:text-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-400/30 focus:border-brand-400 transition-all"
        />
      </div>
      <div className="flex items-center justify-between gap-2">
        <div className="flex gap-1.5 overflow-x-auto scrollbar-none">
          {FILTERS.map(f => (
            <button key={f.key} onClick={() => onStatusFilterChange(f.key)} className={cn('flex-shrink-0 px-2.5 py-1 text-xs font-medium rounded-full transition-all duration-150', statusFilter === f.key ? 'bg-brand-600 text-white' : 'bg-gray-100 dark:bg-[#1C2128] text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-[#30363D]')}>
              {f.label}
            </button>
          ))}
        </div>
        <select value={sortBy} onChange={e => onSortChange(e.target.value as SortKey)} className="text-xs text-gray-500 dark:text-gray-400 bg-transparent border border-gray-200 dark:border-[#30363D] rounded-lg px-2 py-1 focus:outline-none">
          {SORTS.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
        </select>
      </div>
    </div>
  )
}
