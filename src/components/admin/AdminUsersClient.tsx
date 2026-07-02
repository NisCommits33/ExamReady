'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Search, ChevronRight, ArrowUp, ArrowDown } from 'lucide-react'
import { cn, relativeDate } from '@/lib/utils'
import { fmtTokens } from '@/lib/format'
import type { AdminUserRow } from '@/lib/admin'

type SortKey = 'name' | 'sessions' | 'hours' | 'topicsDone' | 'tokens' | 'lastActive'
const COLUMNS: { key: SortKey; label: string; numeric?: boolean }[] = [
  { key: 'name', label: 'User' },
  { key: 'sessions', label: 'Sessions', numeric: true },
  { key: 'hours', label: 'Hours', numeric: true },
  { key: 'topicsDone', label: 'Done', numeric: true },
  { key: 'tokens', label: 'Tokens', numeric: true },
  { key: 'lastActive', label: 'Last active', numeric: true },
]

export function AdminUsersClient({ users }: { users: AdminUserRow[] }) {
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<SortKey>('lastActive')
  const [dir, setDir] = useState<'asc' | 'desc'>('desc')

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    const filtered = q ? users.filter(u => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)) : users
    const sorted = [...filtered].sort((a, b) => {
      let cmp: number
      if (sort === 'name') cmp = a.name.localeCompare(b.name)
      else if (sort === 'lastActive') cmp = (a.lastActive ?? '').localeCompare(b.lastActive ?? '')
      else cmp = (a[sort] as number) - (b[sort] as number)
      return dir === 'asc' ? cmp : -cmp
    })
    return sorted
  }, [users, query, sort, dir])

  function toggleSort(key: SortKey) {
    if (sort === key) setDir(d => (d === 'asc' ? 'desc' : 'asc'))
    else { setSort(key); setDir(key === 'name' ? 'asc' : 'desc') }
  }

  return (
    <div className="bg-white dark:bg-[#161B22] border border-gray-200 dark:border-[#30363D] rounded-xl overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 dark:border-[#21262D]">
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search name or email…"
            className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 dark:border-[#30363D] dark:bg-[#1C2128] dark:text-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-400/30"
          />
        </div>
        <span className="text-xs text-gray-400 tabular-nums">{rows.length} of {users.length}</span>
      </div>

      {/* Header */}
      <div className="hidden md:grid grid-cols-[2fr_0.8fr_0.7fr_0.6fr_0.9fr_1fr_auto] gap-3 px-4 py-2 border-b border-gray-100 dark:border-[#21262D]">
        {COLUMNS.map(c => {
          const active = sort === c.key
          return (
            <button
              key={c.key}
              onClick={() => toggleSort(c.key)}
              aria-label={`Sort by ${c.label}${active ? (dir === 'asc' ? ', ascending' : ', descending') : ''}`}
              className={cn(
                'flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide transition-colors hover:text-gray-600 dark:hover:text-gray-300',
                c.numeric && 'justify-end',
                active ? 'text-gray-700 dark:text-gray-200' : 'text-gray-400',
              )}
            >
              {c.label}
              {active && (dir === 'asc' ? <ArrowUp size={11} /> : <ArrowDown size={11} />)}
            </button>
          )
        })}
        <span />
      </div>

      {/* Rows */}
      <div className="divide-y divide-gray-100 dark:divide-[#21262D]">
        {rows.length === 0 ? (
          <p className="text-xs text-gray-400 py-8 text-center">No users match “{query}”.</p>
        ) : rows.map(u => (
          <Link
            key={u.id}
            href={`/admin/users/${u.id}`}
            className="grid grid-cols-[1fr_auto] md:grid-cols-[2fr_0.8fr_0.7fr_0.6fr_0.9fr_1fr_auto] gap-3 px-4 py-3 items-center hover:bg-gray-50 dark:hover:bg-[#1C2128] transition-colors"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{u.name}</p>
                {u.role === 'super_admin' && (
                  <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-400 uppercase">Admin</span>
                )}
              </div>
              <p className="text-xs text-gray-400 truncate">{u.email}</p>
              <p className="md:hidden text-[11px] text-gray-400 mt-0.5 tabular-nums">
                {u.sessions} sessions · {u.hours}h · {fmtTokens(u.tokens)} tok · {relativeDate(u.lastActive)}
              </p>
            </div>
            <span className="hidden md:block text-sm text-right tabular-nums text-gray-700 dark:text-gray-300">{u.sessions}</span>
            <span className="hidden md:block text-sm text-right tabular-nums text-gray-700 dark:text-gray-300">{u.hours}</span>
            <span className="hidden md:block text-sm text-right tabular-nums text-gray-700 dark:text-gray-300">{u.topicsDone}</span>
            <span className="hidden md:block text-sm text-right tabular-nums text-gray-700 dark:text-gray-300">{fmtTokens(u.tokens)}</span>
            <span className={cn('hidden md:block text-xs text-right', u.lastActive ? 'text-gray-500 dark:text-gray-400' : 'text-gray-300 dark:text-gray-600')}>
              {relativeDate(u.lastActive)}
            </span>
            <ChevronRight size={15} className="text-gray-300 dark:text-gray-600 flex-shrink-0" />
          </Link>
        ))}
      </div>
    </div>
  )
}
