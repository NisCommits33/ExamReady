'use client'

import { useState, useMemo } from 'react'
import { Search } from 'lucide-react'
import { TopicCard } from './TopicCard'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import type { Topic, TopicStatus } from '@/types/database'

type FilterKey = 'all' | 'p1' | 'p2' | 'sa' | 'sb' | 'not_started' | 'in_progress' | 'done' | 'flagged'
type SortKey = 'priority' | 'last_studied' | 'section' | 'status'

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all',         label: 'All 38'      },
  { key: 'p1',          label: 'Paper 1'     },
  { key: 'p2',          label: 'Paper 2'     },
  { key: 'not_started', label: 'Not started' },
  { key: 'in_progress', label: 'In progress' },
  { key: 'done',        label: 'Done'        },
  { key: 'flagged',     label: 'AI flagged'  },
]

const SORTS: { key: SortKey; label: string }[] = [
  { key: 'priority',     label: 'AI Priority' },
  { key: 'last_studied', label: 'Last studied' },
  { key: 'section',      label: 'Section order' },
  { key: 'status',       label: 'Status'       },
]

export function TopicLibraryClient({ initialTopics }: { initialTopics: Topic[] }) {
  const [topics, setTopics] = useState<Topic[]>(initialTopics)
  const [filter, setFilter] = useState<FilterKey>('all')
  const [sort, setSort] = useState<SortKey>('priority')
  const [search, setSearch] = useState('')

  const displayed = useMemo(() => {
    let t = [...topics]

    if (search) {
      const q = search.toLowerCase()
      t = t.filter(x => x.name.toLowerCase().includes(q) || x.subsections.some(s => s.toLowerCase().includes(q)))
    }

    switch (filter) {
      case 'p1': t = t.filter(x => x.paper === 1); break
      case 'p2': t = t.filter(x => x.paper === 2); break
      case 'not_started': t = t.filter(x => x.status === 'not_started'); break
      case 'in_progress': t = t.filter(x => x.status === 'in_progress'); break
      case 'done': t = t.filter(x => x.status === 'done'); break
      case 'flagged': t = t.filter(x => x.is_flagged); break
    }

    switch (sort) {
      case 'priority': t.sort((a, b) => (b.ai_priority ?? 5) - (a.ai_priority ?? 5)); break
      case 'last_studied': t.sort((a, b) => {
        if (!a.last_studied && !b.last_studied) return 0
        if (!a.last_studied) return 1
        if (!b.last_studied) return -1
        return new Date(b.last_studied).getTime() - new Date(a.last_studied).getTime()
      }); break
      case 'status': {
        const order: Record<TopicStatus, number> = { not_started: 0, in_progress: 1, done: 2 }
        t.sort((a, b) => order[a.status] - order[b.status])
        break
      }
    }

    return t
  }, [topics, filter, sort, search])

  async function handleStatusChange(id: string, status: TopicStatus) {
    const supabase = createClient()
    await supabase.from('topics').update({ status }).eq('id', id)
    setTopics(prev => prev.map(t => t.id === id ? { ...t, status } : t))
    toast.success('Status updated · Replanning schedule…')
    fetch('/api/ai/replan-schedule', { method: 'POST' }).catch(() => {})
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-medium text-gray-900">Topics</h1>
          <span className="text-xs font-medium text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">38 topics</span>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-3">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Search topics or subsections…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand-400/30 focus:border-brand-400 transition-all"
        />
      </div>

      {/* Filter pills */}
      <div className="flex gap-2 overflow-x-auto pb-1 mb-3 scrollbar-none">
        {FILTERS.map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={cn(
              'flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition-all duration-150',
              filter === f.key
                ? 'bg-brand-600 text-white border-brand-600'
                : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Sort row */}
      <div className="flex items-center justify-between border-b border-gray-200 pb-2 mb-3">
        <p className="text-xs text-gray-400">{displayed.length} topics</p>
        <div className="flex gap-1">
          {SORTS.map(s => (
            <button
              key={s.key}
              onClick={() => setSort(s.key)}
              className={cn(
                'px-2.5 py-1 rounded text-xs font-medium transition-colors',
                sort === s.key ? 'text-brand-600' : 'text-gray-400 hover:text-gray-600'
              )}
            >
              {s.label}{sort === s.key ? ' ↓' : ''}
            </button>
          ))}
        </div>
      </div>

      {/* Topic cards */}
      <div className="space-y-3">
        {displayed.map(topic => (
          <TopicCard
            key={topic.id}
            topic={topic}
            onStatusChange={handleStatusChange}
          />
        ))}
        {displayed.length === 0 && (
          <div className="py-16 text-center">
            <p className="text-sm text-gray-400">No topics match your filter</p>
          </div>
        )}
      </div>
    </div>
  )
}
