'use client'

import { useState, useEffect } from 'react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Loader2 } from 'lucide-react'
import { useTopics } from '@/hooks/useTopics'
import { SESSION_TYPE_COLORS } from '@/lib/constants'
import type { PlannedSession, SessionType } from '@/types/database'

interface SessionPlanSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: () => void
  editSession?: PlannedSession | null
  defaultDate?: string
  defaultSlot?: string
}

const DURATIONS = [15, 30, 45, 60, 90]
const SESSION_TYPES: SessionType[] = ['study', 'drill', 'review', 'iq']

export function SessionPlanSheet({ open, onOpenChange, onSaved, editSession, defaultDate, defaultSlot }: SessionPlanSheetProps) {
  const { topics } = useTopics()
  const isEdit = !!editSession

  const [sessionType, setSessionType] = useState<SessionType>('study')
  const [date, setDate] = useState(defaultDate ?? new Date().toISOString().split('T')[0])
  const [paper, setPaper] = useState<1 | 2>(1)
  const [topicId, setTopicId] = useState('')
  const [search, setSearch] = useState('')
  const [duration, setDuration] = useState(60)
  const [slotTime, setSlotTime] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    // Sync form fields from the session being edited when it changes.
    if (editSession) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSessionType(editSession.session_type)
      setDate(editSession.scheduled_date)
      setTopicId(editSession.topic_id ?? '')
      setDuration(editSession.duration_mins)
      setSlotTime(editSession.slot_time ?? '')
      const topicData = editSession.topics as { name: string; paper: number } | null
      if (topicData) {
        setSearch(topicData.name)
        setPaper(topicData.paper as 1 | 2)
      } else {
        setSearch('')
      }
    } else {
      setSessionType('study')
      setDate(defaultDate ?? new Date().toISOString().split('T')[0])
      setPaper(1)
      setTopicId('')
      setSearch('')
      setDuration(60)
      setSlotTime(defaultSlot ?? '')
    }
  }, [editSession, defaultDate, defaultSlot, open])

  const filteredTopics = topics.filter(t =>
    t.paper === paper &&
    t.name.toLowerCase().includes(search.toLowerCase())
  )

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (sessionType !== 'iq' && !topicId) { toast.error('Select a topic'); return }
    setSubmitting(true)

    const supabase = createClient()
    const payload = {
      topic_id: sessionType === 'iq' ? null : topicId,
      scheduled_date: date,
      shift_type: null,
      slot_time: slotTime || null,
      duration_mins: duration,
      session_type: sessionType,
    }

    if (isEdit) {
      const { error } = await supabase.from('planned_sessions').update(payload).eq('id', editSession.id)
      if (error) { toast.error('Failed to update session'); setSubmitting(false); return }
      toast.success('Session updated')
    } else {
      const { error } = await supabase.from('planned_sessions').insert({
        ...payload,
        ai_generated: false,
        completed: false,
      })
      if (error) { toast.error('Failed to add session'); setSubmitting(false); return }
      toast.success('Session added')
    }

    onOpenChange(false)
    setSubmitting(false)
    onSaved()
  }

  async function handleDelete() {
    if (!editSession) return
    setSubmitting(true)
    const supabase = createClient()
    await supabase.from('planned_sessions').delete().eq('id', editSession.id)
    toast.success('Session removed')
    onOpenChange(false)
    setSubmitting(false)
    onSaved()
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="md:right-0 md:left-auto md:top-0 md:h-full md:w-[420px] md:rounded-l-2xl rounded-t-2xl max-h-[90dvh] overflow-y-auto p-0">
        <div className="px-5 pt-5 pb-2 border-b border-gray-100 dark:border-[#21262D]">
          <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto mb-4 md:hidden" />
          <SheetHeader className="text-left">
            <SheetTitle className="text-base font-semibold text-gray-900 dark:text-gray-100">
              {isEdit ? 'Edit session' : 'Add session'}
            </SheetTitle>
          </SheetHeader>
        </div>

        <form onSubmit={handleSubmit} className="px-5 py-5 space-y-5">
          {/* Session type */}
          <div>
            <label className="text-xs font-medium text-gray-500 mb-2 block">Type</label>
            <div className="grid grid-cols-4 gap-2">
              {SESSION_TYPES.map(t => {
                const config = SESSION_TYPE_COLORS[t]
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => { setSessionType(t); if (t === 'iq') { setTopicId(''); setSearch('') } }}
                    className={cn(
                      'py-2.5 rounded-lg text-xs font-medium border-2 transition-all duration-150',
                      sessionType === t
                        ? `${config.bar} text-white border-transparent`
                        : 'border-gray-200 dark:border-[#30363D] bg-white dark:bg-[#1C2128] text-gray-500 dark:text-gray-400 hover:border-gray-300'
                    )}
                  >
                    {config.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Date */}
          <div>
            <label className="text-xs font-medium text-gray-500 mb-2 block">Date</label>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="w-full px-3 py-2.5 text-sm border border-gray-200 dark:border-[#30363D] dark:bg-[#1C2128] dark:text-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-400/30 focus:border-brand-400 transition-all"
            />
          </div>

          {/* Topic (hidden for IQ) */}
          {sessionType !== 'iq' && (
            <>
              <div>
                <label className="text-xs font-medium text-gray-500 mb-2 block">Paper</label>
                <div className="grid grid-cols-2 gap-2">
                  {([1, 2] as const).map(p => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => { setPaper(p); setTopicId(''); setSearch('') }}
                      className={cn(
                        'py-3 rounded-lg text-sm font-medium border-2 transition-all duration-150',
                        paper === p
                          ? p === 1
                            ? 'border-brand-600 bg-brand-50 text-brand-800'
                            : 'border-teal-400 bg-teal-50 text-teal-800'
                          : 'border-gray-200 dark:border-[#30363D] bg-white dark:bg-[#1C2128] text-gray-500 dark:text-gray-400 hover:border-gray-300'
                      )}
                    >
                      Paper {p}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-500 mb-2 block">Topic</label>
                <input
                  type="text"
                  placeholder="Search topics…"
                  value={search}
                  onChange={e => { setSearch(e.target.value); setTopicId('') }}
                  className="w-full px-3 py-2.5 text-sm border border-gray-200 dark:border-[#30363D] dark:bg-[#1C2128] dark:text-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-400/30 focus:border-brand-400 transition-all"
                />
                {search && !topicId && (
                  <div className="mt-1 max-h-40 overflow-y-auto border border-gray-200 dark:border-[#30363D] rounded-lg bg-white dark:bg-[#1C2128] divide-y divide-gray-100 dark:divide-[#30363D]">
                    {filteredTopics.slice(0, 8).map(t => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => { setTopicId(t.id); setSearch(t.name) }}
                        className="w-full px-3 py-2.5 text-left hover:bg-gray-50 dark:hover:bg-[#30363D] transition-colors"
                      >
                        <span className="text-sm text-gray-800 dark:text-gray-200">{t.name}</span>
                        <span className="ml-2 text-[11px] text-gray-400">§{t.section}</span>
                      </button>
                    ))}
                    {filteredTopics.length === 0 && (
                      <p className="px-3 py-2.5 text-sm text-gray-400">No topics found</p>
                    )}
                  </div>
                )}
              </div>
            </>
          )}

          {/* Duration */}
          <div>
            <label className="text-xs font-medium text-gray-500 mb-2 block">Duration</label>
            <div className="flex gap-2">
              {DURATIONS.map(d => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDuration(d)}
                  className={cn(
                    'flex-1 py-2.5 text-xs font-medium rounded-lg border transition-all duration-150',
                    duration === d
                      ? 'bg-brand-600 text-white border-brand-600'
                      : 'bg-white dark:bg-[#1C2128] text-gray-600 dark:text-gray-400 border-gray-200 dark:border-[#30363D] hover:border-gray-300'
                  )}
                >
                  {d}m
                </button>
              ))}
            </div>
          </div>

          {/* Time slot */}
          <div>
            <label className="text-xs font-medium text-gray-500 mb-2 block">
              Time slot <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <input
              type="time"
              value={slotTime}
              onChange={e => setSlotTime(e.target.value)}
              className="w-full px-3 py-2.5 text-sm border border-gray-200 dark:border-[#30363D] dark:bg-[#1C2128] dark:text-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-400/30 focus:border-brand-400 transition-all"
            />
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={submitting || (sessionType !== 'iq' && !topicId)}
            className={cn(
              'w-full py-3 rounded-lg text-sm font-medium transition-all duration-150',
              'bg-brand-600 text-white hover:bg-brand-800 active:scale-[0.98]',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400'
            )}
          >
            {submitting ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 size={15} className="animate-spin" /> Saving…
              </span>
            ) : (
              isEdit ? 'Save changes' : 'Add session'
            )}
          </button>

          {/* Delete (edit mode only) */}
          {isEdit && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={submitting}
              className="w-full py-2.5 text-sm font-medium text-red-500 hover:text-red-700 dark:hover:text-red-400 transition-colors disabled:opacity-50"
            >
              Delete this session
            </button>
          )}
        </form>
      </SheetContent>
    </Sheet>
  )
}
