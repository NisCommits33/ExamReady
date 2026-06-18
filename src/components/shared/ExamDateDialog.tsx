'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { CalendarClock, Loader2, X } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ExamDateDialog({ open, onOpenChange }: Props) {
  const router = useRouter()
  const [date, setDate] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    async function load() {
      setLoading(true)
      const supabase = createClient()
      const { data } = await supabase.from('user_settings').select('value').eq('key', 'exam_date').maybeSingle()
      setDate(data?.value ?? '')
      setLoading(false)
    }
    load()
  }, [open])

  async function save() {
    if (!date) { toast.error('Pick a date'); return }
    setSaving(true)
    const supabase = createClient()
    await Promise.all([
      supabase.from('user_settings').upsert({ key: 'exam_date', value: date }, { onConflict: 'user_id,key' }),
      supabase.from('enrollments').update({ exam_date: date }).eq('is_active', true),
    ])
    toast.success('Exam date updated')
    setSaving(false)
    onOpenChange(false)
    router.refresh()
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => onOpenChange(false)}>
      <div className="absolute inset-0 bg-black/40" />
      <div className="relative w-full max-w-sm bg-white dark:bg-[#161B22] border border-gray-200 dark:border-[#30363D] rounded-2xl p-5 shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <CalendarClock size={16} className="text-brand-500" />
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Set exam date</h2>
          </div>
          <button onClick={() => onOpenChange(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X size={16} />
          </button>
        </div>

        {loading ? (
          <div className="h-10 bg-gray-100 dark:bg-[#1C2128] rounded-lg animate-pulse" />
        ) : (
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className="w-full px-3 py-2.5 text-sm border border-gray-200 dark:border-[#30363D] dark:bg-[#1C2128] dark:text-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-400/30 focus:border-brand-400"
          />
        )}

        <button
          onClick={save}
          disabled={saving || loading}
          className="mt-4 w-full flex items-center justify-center gap-2 py-2.5 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-800 transition-colors disabled:opacity-50"
        >
          {saving && <Loader2 size={14} className="animate-spin" />} Save
        </button>
      </div>
    </div>
  )
}
