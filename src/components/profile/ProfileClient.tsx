'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Pencil, Check, X, Loader2, GraduationCap, CalendarClock, Settings,
  LogOut, Flame, Clock, BookCheck, Target, ChevronRight, CalendarDays,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { ExamDateDialog } from '@/components/shared/ExamDateDialog'
import { SettingsSheet } from '@/components/settings/SettingsSheet'
import { ShiftConfigDialog } from '@/components/profile/ShiftConfigDialog'

interface Props {
  name: string
  email: string
  role: string
  memberSince: string | null
  examName: string | null
  examBody: string | null
  examDate: string | null
  sessionCount: number
  totalHours: number
  topicsDone: number
  topicsTotal: number
}

export function ProfileClient(props: Props) {
  const router = useRouter()
  const [name, setName] = useState(props.name)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(props.name)
  const [saving, setSaving] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const [dateOpen, setDateOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [shiftsOpen, setShiftsOpen] = useState(false)

  const initial = (name || props.email || '?').trim().charAt(0).toUpperCase()
  const readiness = props.topicsTotal > 0 ? Math.round((props.topicsDone / props.topicsTotal) * 100) : 0

  async function saveName() {
    if (!draft.trim()) { toast.error('Name can\'t be empty'); return }
    setSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase.from('profiles').update({ full_name: draft.trim() }).eq('id', user!.id)
    if (error) { toast.error('Failed to update'); setSaving(false); return }
    setName(draft.trim()); setEditing(false); setSaving(false)
    toast.success('Profile updated')
    router.refresh()
  }

  async function signOut() {
    setSigningOut(true)
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  const examDateLabel = props.examDate
    ? new Date(props.examDate).toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
    : 'Not set'

  const stats = [
    { label: 'Sessions', value: String(props.sessionCount), Icon: Flame, tint: 'text-brand-500' },
    { label: 'Hours', value: `${props.totalHours}`, Icon: Clock, tint: 'text-teal-500' },
    { label: 'Topics done', value: `${props.topicsDone}/${props.topicsTotal}`, Icon: BookCheck, tint: 'text-success-500' },
    { label: 'Readiness', value: `${readiness}%`, Icon: Target, tint: 'text-purple-500' },
  ]

  return (
    <div className="max-w-2xl mx-auto pb-10">
      <h1 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-5">Profile</h1>

      {/* Identity */}
      <section className="bg-white dark:bg-[#161B22] border border-gray-200 dark:border-[#30363D] rounded-xl p-5 mb-4">
        <div className="flex items-start gap-4">
          <div className="w-16 h-16 rounded-full bg-brand-600 flex items-center justify-center text-white text-2xl font-semibold flex-shrink-0" aria-hidden="true">
            {initial}
          </div>
          <div className="flex-1 min-w-0">
            {editing ? (
              <div className="flex items-center gap-2">
                <input
                  value={draft}
                  onChange={e => setDraft(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') saveName(); if (e.key === 'Escape') { setEditing(false); setDraft(name) } }}
                  autoFocus
                  aria-label="Display name"
                  className="flex-1 min-w-0 px-3 py-2 text-sm border border-gray-200 dark:border-[#30363D] dark:bg-[#1C2128] dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-400/40 focus:border-brand-400"
                />
                <button onClick={saveName} disabled={saving} aria-label="Save name" className="p-2 rounded-lg bg-brand-600 text-white hover:bg-brand-800 transition-colors disabled:opacity-50">
                  {saving ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
                </button>
                <button onClick={() => { setEditing(false); setDraft(name) }} aria-label="Cancel" className="p-2 rounded-lg border border-gray-200 dark:border-[#30363D] text-gray-500 hover:bg-gray-50 dark:hover:bg-[#1C2128] transition-colors">
                  <X size={15} />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 truncate">{name || 'Unnamed'}</h2>
                <button onClick={() => { setDraft(name); setEditing(true) }} aria-label="Edit name" className="p-1.5 rounded-md text-gray-400 hover:text-brand-600 hover:bg-gray-50 dark:hover:bg-[#1C2128] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400">
                  <Pencil size={14} />
                </button>
              </div>
            )}
            <p className="text-sm text-gray-500 dark:text-gray-400 truncate mt-0.5">{props.email}</p>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-400 capitalize">{props.role}</span>
              {props.memberSince && (
                <span className="text-[11px] text-gray-400">Joined {new Date(props.memberSince).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</span>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4" aria-label="Study statistics">
        {stats.map(s => (
          <div key={s.label} className="bg-white dark:bg-[#161B22] border border-gray-200 dark:border-[#30363D] rounded-xl p-3.5">
            <s.Icon size={15} className={cn('mb-2', s.tint)} aria-hidden="true" />
            <p className="text-xl font-semibold text-gray-900 dark:text-gray-100 tabular-nums leading-none">{s.value}</p>
            <p className="text-[11px] text-gray-400 uppercase tracking-wide mt-1">{s.label}</p>
          </div>
        ))}
      </section>

      {/* Active exam */}
      <section className="bg-white dark:bg-[#161B22] border border-gray-200 dark:border-[#30363D] rounded-xl mb-4 overflow-hidden">
        <div className="px-5 py-4 flex items-center gap-3 border-b border-gray-100 dark:border-[#21262D]">
          <div className="w-9 h-9 rounded-lg bg-brand-50 dark:bg-brand-900/20 flex items-center justify-center flex-shrink-0">
            <GraduationCap size={17} className="text-brand-600 dark:text-brand-400" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{props.examName ?? 'No exam selected'}</p>
            {props.examBody && <p className="text-xs text-gray-400 truncate">{props.examBody}</p>}
          </div>
        </div>
        <button
          onClick={() => setDateOpen(true)}
          className="w-full flex items-center gap-3 px-5 py-3.5 text-left hover:bg-gray-50 dark:hover:bg-[#1C2128] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-400"
        >
          <CalendarClock size={16} className="text-gray-400 flex-shrink-0" aria-hidden="true" />
          <span className="flex-1 text-sm text-gray-700 dark:text-gray-300">Exam date</span>
          <span className="text-sm text-gray-500 dark:text-gray-400 tabular-nums">{examDateLabel}</span>
          <ChevronRight size={15} className="text-gray-300 dark:text-gray-600 flex-shrink-0" aria-hidden="true" />
        </button>
        <button
          onClick={() => setShiftsOpen(true)}
          className="w-full flex items-center gap-3 px-5 py-3.5 text-left border-t border-gray-100 dark:border-[#21262D] hover:bg-gray-50 dark:hover:bg-[#1C2128] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-400"
        >
          <CalendarDays size={16} className="text-gray-400 flex-shrink-0" aria-hidden="true" />
          <span className="flex-1 text-sm text-gray-700 dark:text-gray-300">Shift schedule</span>
          <span className="text-sm text-gray-500 dark:text-gray-400">A / B roster</span>
          <ChevronRight size={15} className="text-gray-300 dark:text-gray-600 flex-shrink-0" aria-hidden="true" />
        </button>
      </section>

      {/* Account */}
      <section className="bg-white dark:bg-[#161B22] border border-gray-200 dark:border-[#30363D] rounded-xl mb-4 overflow-hidden">
        <button
          onClick={() => setSettingsOpen(true)}
          className="w-full flex items-center gap-3 px-5 py-3.5 text-left hover:bg-gray-50 dark:hover:bg-[#1C2128] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-400"
        >
          <Settings size={16} className="text-gray-400 flex-shrink-0" aria-hidden="true" />
          <span className="flex-1 text-sm text-gray-700 dark:text-gray-300">Settings &amp; chapters</span>
          <ChevronRight size={15} className="text-gray-300 dark:text-gray-600 flex-shrink-0" aria-hidden="true" />
        </button>
      </section>

      {/* Destructive — visually separated */}
      <button
        onClick={signOut}
        disabled={signingOut}
        className="w-full flex items-center justify-center gap-2 py-3 text-sm font-medium text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/40 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/15 transition-colors disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
      >
        {signingOut ? <Loader2 size={15} className="animate-spin" /> : <LogOut size={15} />}
        {signingOut ? 'Signing out…' : 'Sign out'}
      </button>

      <ExamDateDialog open={dateOpen} onOpenChange={setDateOpen} />
      <SettingsSheet open={settingsOpen} onOpenChange={setSettingsOpen} />
      <ShiftConfigDialog open={shiftsOpen} onOpenChange={setShiftsOpen} />
    </div>
  )
}
