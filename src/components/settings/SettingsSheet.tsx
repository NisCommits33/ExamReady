'use client'

import { useState, useEffect } from 'react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Loader2, Plus, Trash2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SettingsSheet({ open, onOpenChange }: Props) {
  const [examDate, setExamDate] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // New chapter form
  const [chapterName, setChapterName] = useState('')
  const [chapterPaper, setChapterPaper] = useState<1 | 2>(2)
  const [chapterSection, setChapterSection] = useState<'A' | 'B'>('B')
  const [chapterNumber, setChapterNumber] = useState('')
  const [addingChapter, setAddingChapter] = useState(false)

  useEffect(() => {
    if (!open) return
    async function load() {
      setLoading(true)
      const supabase = createClient()
      const { data } = await supabase.from('user_settings').select('value').eq('key', 'exam_date').single()
      setExamDate(data?.value ?? '2025-08-13')
      setLoading(false)
    }
    load()
  }, [open])

  async function saveExamDate() {
    setSaving(true)
    const supabase = createClient()
    await supabase.from('user_settings').upsert({ key: 'exam_date', value: examDate })
    toast.success('Exam date updated')
    setSaving(false)
  }

  async function addChapter() {
    if (!chapterName.trim() || !chapterNumber.trim()) { toast.error('Name and number are required'); return }
    setAddingChapter(true)
    const supabase = createClient()
    const { data: enr } = await supabase.from('enrollments').select('exam_id').eq('is_active', true).limit(1).maybeSingle()
    if (!enr) { toast.error('No active exam'); setAddingChapter(false); return }
    const { error } = await supabase.from('topics').insert({
      name: chapterName.trim(),
      paper: chapterPaper,
      section: chapterSection,
      topic_number: chapterNumber.trim(),
      subsections: [],
      ai_priority: 5,
      exam_id: enr.exam_id,
    })
    if (error) {
      toast.error('Failed to add chapter')
    } else {
      toast.success(`Chapter "${chapterName}" added`)
      setChapterName('')
      setChapterNumber('')
    }
    setAddingChapter(false)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="md:right-0 md:left-auto md:top-0 md:h-full md:w-[420px] md:rounded-l-2xl rounded-t-2xl max-h-[90dvh] overflow-y-auto p-0">
        <div className="px-5 pt-5 pb-2 border-b border-gray-100 dark:border-[#21262D]">
          <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto mb-4 md:hidden" />
          <SheetHeader className="text-left">
            <SheetTitle className="text-base font-semibold text-gray-900 dark:text-gray-100">Settings</SheetTitle>
          </SheetHeader>
        </div>

        <div className="px-5 py-5 space-y-6">
          {/* Exam date */}
          <div>
            <label className="text-xs font-medium text-gray-500 mb-2 block">Exam date</label>
            {loading ? (
              <div className="h-10 bg-gray-100 dark:bg-[#1C2128] rounded-lg animate-pulse" />
            ) : (
              <div className="flex gap-2">
                <input
                  type="date"
                  value={examDate}
                  onChange={e => setExamDate(e.target.value)}
                  className="flex-1 px-3 py-2.5 text-sm border border-gray-200 dark:border-[#30363D] dark:bg-[#1C2128] dark:text-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-400/30 focus:border-brand-400 transition-all"
                />
                <button
                  onClick={saveExamDate}
                  disabled={saving}
                  className="px-4 py-2.5 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-800 transition-colors disabled:opacity-50"
                >
                  {saving ? <Loader2 size={14} className="animate-spin" /> : 'Save'}
                </button>
              </div>
            )}
          </div>

          {/* Add chapter */}
          <div>
            <label className="text-xs font-medium text-gray-500 mb-2 block">Add new chapter</label>
            <div className="space-y-3">
              <input
                type="text"
                placeholder="Chapter name…"
                value={chapterName}
                onChange={e => setChapterName(e.target.value)}
                className="w-full px-3 py-2.5 text-sm border border-gray-200 dark:border-[#30363D] dark:bg-[#1C2128] dark:text-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-400/30 focus:border-brand-400 transition-all"
              />
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[10px] text-gray-400 mb-1 block">Paper</label>
                  <div className="flex gap-1">
                    {([1, 2] as const).map(p => (
                      <button key={p} type="button" onClick={() => setChapterPaper(p)}
                        className={cn('flex-1 py-2 text-xs font-medium rounded-lg border transition-all', chapterPaper === p ? 'bg-brand-600 text-white border-brand-600' : 'border-gray-200 dark:border-[#30363D] text-gray-500')}>
                        P{p}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-[10px] text-gray-400 mb-1 block">Section</label>
                  <div className="flex gap-1">
                    {(['A', 'B'] as const).map(s => (
                      <button key={s} type="button" onClick={() => setChapterSection(s)}
                        className={cn('flex-1 py-2 text-xs font-medium rounded-lg border transition-all', chapterSection === s ? 'bg-brand-600 text-white border-brand-600' : 'border-gray-200 dark:border-[#30363D] text-gray-500')}>
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-[10px] text-gray-400 mb-1 block">Number</label>
                  <input
                    type="text"
                    placeholder="31"
                    value={chapterNumber}
                    onChange={e => setChapterNumber(e.target.value)}
                    className="w-full px-2 py-2 text-xs text-center border border-gray-200 dark:border-[#30363D] dark:bg-[#1C2128] dark:text-gray-200 rounded-lg focus:outline-none"
                  />
                </div>
              </div>
              <button
                onClick={addChapter}
                disabled={addingChapter || !chapterName.trim()}
                className="w-full flex items-center justify-center gap-1.5 py-2.5 text-sm font-medium text-white bg-brand-600 rounded-lg hover:bg-brand-800 transition-colors disabled:opacity-50"
              >
                {addingChapter ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                Add chapter
              </button>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
