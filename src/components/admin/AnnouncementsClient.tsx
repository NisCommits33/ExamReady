'use client'

import { useState, useEffect } from 'react'
import { Loader2, Plus, Trash2, Megaphone } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { relativeDate } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { useConfirm } from '@/components/ui/ConfirmDialog'

interface Announcement {
  id: string
  message: string
  level: 'info' | 'warning' | 'critical'
  active: boolean
  created_at: string
}

const LEVELS = ['info', 'warning', 'critical'] as const

export function AnnouncementsClient() {
  const confirm = useConfirm()
  const [items, setItems] = useState<Announcement[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [level, setLevel] = useState<'info' | 'warning' | 'critical'>('info')
  const [creating, setCreating] = useState(false)

  async function load() {
    const supabase = createClient()
    const { data } = await supabase.from('announcements').select('*').order('created_at', { ascending: false })
    setItems((data ?? []) as Announcement[])
    setLoading(false)
  }
  // eslint-disable-next-line react-hooks/set-state-in-effect -- async initial load
  useEffect(() => { load() }, [])

  async function create() {
    if (!message.trim()) { toast.error('Message required'); return }
    setCreating(true)
    const supabase = createClient()
    const { error } = await supabase.from('announcements').insert({ message: message.trim(), level })
    setCreating(false)
    if (error) { toast.error('Failed to create'); return }
    setMessage(''); setLevel('info'); toast.success('Announcement posted'); load()
  }

  async function toggle(a: Announcement) {
    if (!(await confirm({ title: a.active ? 'Hide announcement?' : 'Show announcement?', message: a.active ? 'It will no longer be shown to users.' : 'It will be shown as a banner to all users.', confirmLabel: a.active ? 'Hide' : 'Show' }))) return
    const supabase = createClient()
    setItems(prev => prev.map(x => x.id === a.id ? { ...x, active: !x.active } : x))
    await supabase.from('announcements').update({ active: !a.active }).eq('id', a.id)
  }

  async function remove(id: string) {
    if (!(await confirm({ title: 'Delete announcement?', message: 'This permanently removes the announcement.', confirmLabel: 'Delete', danger: true }))) return
    const supabase = createClient()
    setItems(prev => prev.filter(x => x.id !== id))
    await supabase.from('announcements').delete().eq('id', id)
    toast.success('Deleted')
  }

  return (
    <div className="space-y-4">
      {/* Composer */}
      <section className="bg-white dark:bg-[#161B22] border border-gray-200 dark:border-[#30363D] rounded-xl p-4">
        <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">New announcement</p>
        <textarea
          value={message}
          onChange={e => setMessage(e.target.value)}
          rows={2}
          placeholder="Shown as a banner to all users…"
          className="w-full text-sm border border-gray-200 dark:border-[#30363D] dark:bg-[#1C2128] dark:text-gray-200 rounded-lg p-3 resize-none focus:outline-none focus:ring-2 focus:ring-brand-400/30 mb-3"
        />
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            {LEVELS.map(l => (
              <button key={l} onClick={() => setLevel(l)}
                className={cn('text-xs font-medium px-2.5 py-1.5 rounded-lg border capitalize transition-colors',
                  level === l ? 'bg-brand-600 text-white border-brand-600' : 'border-gray-200 dark:border-[#30363D] text-gray-500')}>
                {l}
              </button>
            ))}
          </div>
          <button onClick={create} disabled={creating || !message.trim()}
            className="ml-auto inline-flex items-center gap-1.5 text-sm font-medium text-white bg-brand-600 px-4 py-2 rounded-lg hover:bg-brand-800 transition-colors disabled:opacity-50">
            {creating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Post
          </button>
        </div>
      </section>

      {/* List */}
      <section className="bg-white dark:bg-[#161B22] border border-gray-200 dark:border-[#30363D] rounded-xl p-4">
        <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">Announcements</p>
        {loading ? (
          <Loader2 size={16} className="animate-spin text-gray-400 mx-auto my-4" />
        ) : items.length === 0 ? (
          <p className="text-xs text-gray-400 py-4 text-center flex items-center justify-center gap-1.5"><Megaphone size={13} /> None yet</p>
        ) : (
          <div className="space-y-2">
            {items.map(a => (
              <div key={a.id} className="flex items-start gap-3 p-3 rounded-lg border border-gray-100 dark:border-[#21262D]">
                <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded-full uppercase flex-shrink-0 mt-0.5',
                  a.level === 'critical' ? 'bg-red-50 text-red-600' : a.level === 'warning' ? 'bg-amber-50 text-amber-600' : 'bg-brand-50 text-brand-700')}>
                  {a.level}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-800 dark:text-gray-200">{a.message}</p>
                  <p className="text-[11px] text-gray-400 mt-0.5">{relativeDate(a.created_at)}</p>
                </div>
                <button onClick={() => toggle(a)} className={cn('text-xs font-medium px-2 py-1 rounded-md flex-shrink-0', a.active ? 'text-success-600' : 'text-gray-400')}>
                  {a.active ? 'Active' : 'Hidden'}
                </button>
                <button onClick={() => remove(a.id)} className="text-gray-300 hover:text-red-500 flex-shrink-0"><Trash2 size={14} /></button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
