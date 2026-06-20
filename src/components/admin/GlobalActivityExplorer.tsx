'use client'

import { useMemo, useState } from 'react'
import { Download } from 'lucide-react'
import { relativeDate } from '@/lib/utils'
import { actionMeta } from '@/lib/activity-meta'
import type { AdminActivityItem, AdminUserRow } from '@/lib/admin'

function downloadCsv(filename: string, rows: (string | number | null)[][]) {
  const esc = (v: string | number | null) => `"${String(v ?? '').replace(/"/g, '""')}"`
  const csv = rows.map(r => r.map(esc).join(',')).join('\n')
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

export function GlobalActivityExplorer({ items, users }: { items: AdminActivityItem[]; users: AdminUserRow[] }) {
  const [user, setUser] = useState('')
  const [action, setAction] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  const actions = useMemo(() => Array.from(new Set(items.map(i => i.action))).sort(), [items])

  const filtered = useMemo(() => items.filter(i => {
    if (user && i.userId !== user) return false
    if (action && i.action !== action) return false
    const day = i.created_at.slice(0, 10)
    if (from && day < from) return false
    if (to && day > to) return false
    return true
  }), [items, user, action, from, to])

  const exportActivity = () => downloadCsv('activity.csv', [
    ['time', 'user', 'action', 'topic'],
    ...filtered.map(i => [i.created_at, i.userName, i.action, i.topic]),
  ])
  const exportUsers = () => downloadCsv('users.csv', [
    ['name', 'email', 'role', 'joined', 'last_active', 'sessions', 'hours', 'topics_done', 'activity'],
    ...users.map(u => [u.name, u.email, u.role, u.joined, u.lastActive, u.sessions, u.hours, u.topicsDone, u.activityCount]),
  ])

  const inputCls = 'text-xs border border-gray-200 dark:border-[#30363D] dark:bg-[#1C2128] dark:text-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand-400/30'

  return (
    <div className="bg-white dark:bg-[#161B22] border border-gray-200 dark:border-[#30363D] rounded-xl p-4">
      <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Activity ({filtered.length})</p>
        <div className="flex gap-2">
          <button onClick={exportActivity} className="inline-flex items-center gap-1 text-xs font-medium text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-[#30363D] px-2 py-1 rounded-lg hover:bg-gray-50 dark:hover:bg-[#1C2128]"><Download size={12} /> Activity CSV</button>
          <button onClick={exportUsers} className="inline-flex items-center gap-1 text-xs font-medium text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-[#30363D] px-2 py-1 rounded-lg hover:bg-gray-50 dark:hover:bg-[#1C2128]"><Download size={12} /> Users CSV</button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        <select value={user} onChange={e => setUser(e.target.value)} className={inputCls}>
          <option value="">All users</option>
          {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
        <select value={action} onChange={e => setAction(e.target.value)} className={inputCls}>
          <option value="">All actions</option>
          {actions.map(ac => <option key={ac} value={ac}>{actionMeta(ac).label}</option>)}
        </select>
        <input type="date" value={from} onChange={e => setFrom(e.target.value)} className={inputCls} aria-label="From date" />
        <input type="date" value={to} onChange={e => setTo(e.target.value)} className={inputCls} aria-label="To date" />
        {(user || action || from || to) && (
          <button onClick={() => { setUser(''); setAction(''); setFrom(''); setTo('') }} className="text-xs text-gray-400 hover:text-gray-600 px-2">Clear</button>
        )}
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <p className="text-xs text-gray-400 py-4 text-center">No matching activity</p>
      ) : (
        <div className="space-y-2.5 max-h-[480px] overflow-y-auto">
          {filtered.slice(0, 300).map(i => {
            const meta = actionMeta(i.action)
            return (
              <div key={i.id} className="flex items-center gap-3">
                <meta.Icon size={14} className={`${meta.color} flex-shrink-0`} />
                <p className="text-xs text-gray-700 dark:text-gray-300 flex-1 truncate">
                  <span className="font-medium text-gray-900 dark:text-gray-100">{i.userName}</span>
                  <span className="text-gray-400"> · </span>{meta.label}
                  {i.topic && <span className="text-gray-400"> · {i.topic}</span>}
                </p>
                <span className="text-[11px] text-gray-400 flex-shrink-0">{relativeDate(i.created_at)}</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
