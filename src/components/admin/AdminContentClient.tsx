'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Plus, Trash2, ChevronDown, FileText } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { TopicSourceEditor } from '@/components/admin/TopicSourceEditor'
import { useConfirm, type ConfirmOptions } from '@/components/ui/ConfirmDialog'
import type { AdminExam, AdminShiftType, AdminTopicBrief, AdminSectionBrief } from '@/lib/admin'

async function post(body: Record<string, unknown>): Promise<boolean> {
  const res = await fetch('/api/admin/content', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  const json = await res.json()
  if (!res.ok) { toast.error(json.error ?? 'Failed'); return false }
  return true
}

export function AdminContentClient({ exams, shiftTypes, topics, sections }: { exams: AdminExam[]; shiftTypes: AdminShiftType[]; topics: AdminTopicBrief[]; sections: AdminSectionBrief[] }) {
  const router = useRouter()
  const confirm = useConfirm()
  const [busy, setBusy] = useState<string | null>(null)
  const [openExam, setOpenExam] = useState<string | null>(null)
  const [sourceTopic, setSourceTopic] = useState<string | null>(null)
  const [newTopic, setNewTopic] = useState({ name: '', number: '', paper: 2, section: 'B', sectionId: '' })

  async function run(key: string, body: Record<string, unknown>, ok: string, confirmOpts?: ConfirmOptions) {
    if (confirmOpts && !(await confirm(confirmOpts))) return false
    setBusy(key)
    const success = await post(body)
    setBusy(null)
    if (success) { toast.success(ok); router.refresh() }
    return success
  }

  return (
    <div className="space-y-4">
      {/* Shift types */}
      <section className="bg-white dark:bg-[#161B22] border border-gray-200 dark:border-[#30363D] rounded-xl p-4">
        <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">Shift study windows</p>
        <div className="space-y-2">
          {shiftTypes.map(s => <ShiftRow key={s.type} shift={s} busy={busy} run={run} />)}
        </div>
      </section>

      {/* Exams */}
      <section className="bg-white dark:bg-[#161B22] border border-gray-200 dark:border-[#30363D] rounded-xl p-4">
        <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">Exams</p>
        <div className="space-y-2">
          {exams.map(e => {
            const examTopics = topics.filter(t => t.exam_id === e.id)
            const examSections = sections.filter(s => s.exam_id === e.id)
            const open = openExam === e.id
            return (
              <div key={e.id} className="border border-gray-100 dark:border-[#21262D] rounded-lg">
                <div className="flex items-center gap-2 p-3">
                  <button onClick={() => setOpenExam(open ? null : e.id)} className="flex-1 flex items-center gap-2 min-w-0 text-left">
                    <ChevronDown size={14} className={cn('text-gray-400 transition-transform', open && 'rotate-180')} />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{e.name}</p>
                      <p className="text-[11px] text-gray-400">{e.topics} topics · {e.sections} sections · {e.enrollments} enrolled</p>
                    </div>
                  </button>
                  <button
                    onClick={() => run('pub-' + e.id, { action: 'updateExam', examId: e.id, fields: { is_public: !e.is_public } }, e.is_public ? 'Unpublished' : 'Published', { title: e.is_public ? 'Make exam private?' : 'Publish exam?', message: e.is_public ? `"${e.name}" will be hidden from the public catalog.` : `"${e.name}" will appear in the public catalog for all users.`, confirmLabel: e.is_public ? 'Make private' : 'Publish' })}
                    disabled={busy !== null}
                    className={cn('text-xs font-medium px-2 py-1 rounded-md flex-shrink-0', e.is_public ? 'bg-success-50 text-success-700' : 'bg-gray-100 dark:bg-[#1C2128] text-gray-500')}
                  >
                    {busy === 'pub-' + e.id ? <Loader2 size={12} className="animate-spin" /> : e.is_public ? 'Public' : 'Private'}
                  </button>
                </div>

                {open && (
                  <div className="px-3 pb-3 space-y-2 border-t border-gray-100 dark:border-[#21262D] pt-3">
                    {/* Topics */}
                    {examTopics.map(t => (
                      <div key={t.id}>
                        <div className="flex items-center gap-2 text-xs">
                          <span className="flex-1 text-gray-700 dark:text-gray-300 truncate">{t.topic_number}. {t.name} <span className="text-gray-400">P{t.paper}{t.section}</span></span>
                          <button
                            onClick={() => setSourceTopic(sourceTopic === t.id ? null : t.id)}
                            title={t.hasSource ? 'Edit official source' : 'Add official source'}
                            className={cn('inline-flex items-center gap-1 px-1.5 py-1 rounded-md transition-colors', t.hasSource ? 'text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-900/20' : 'text-gray-300 hover:text-brand-600')}
                          >
                            <FileText size={13} />{t.hasSource && <span className="w-1.5 h-1.5 rounded-full bg-brand-500" />}
                          </button>
                          <button onClick={() => run('del-' + t.id, { action: 'deleteTopic', topicId: t.id }, 'Topic deleted', { title: 'Delete topic?', message: `"${t.topic_number}. ${t.name}" and its notes/subtopics will be permanently removed.`, confirmLabel: 'Delete', danger: true })} disabled={busy !== null} className="text-gray-300 hover:text-red-500"><Trash2 size={13} /></button>
                        </div>
                        {sourceTopic === t.id && <TopicSourceEditor topicId={t.id} onClose={() => setSourceTopic(null)} />}
                      </div>
                    ))}
                    {/* Add topic */}
                    <div className="flex flex-wrap items-center gap-1.5 pt-2">
                      <input value={newTopic.name} onChange={ev => setNewTopic(v => ({ ...v, name: ev.target.value }))} placeholder="New topic name" className="flex-1 min-w-[120px] text-xs border border-gray-200 dark:border-[#30363D] dark:bg-[#1C2128] rounded-md px-2 py-1.5 focus:outline-none" />
                      <input value={newTopic.number} onChange={ev => setNewTopic(v => ({ ...v, number: ev.target.value }))} placeholder="No." className="w-12 text-xs text-center border border-gray-200 dark:border-[#30363D] dark:bg-[#1C2128] rounded-md px-1 py-1.5 focus:outline-none" />
                      <select value={newTopic.sectionId} onChange={ev => setNewTopic(v => ({ ...v, sectionId: ev.target.value }))} className="text-xs border border-gray-200 dark:border-[#30363D] dark:bg-[#1C2128] rounded-md px-1 py-1.5 max-w-[140px]">
                        <option value="">Section…</option>
                        {examSections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                      <select value={newTopic.paper} onChange={ev => setNewTopic(v => ({ ...v, paper: Number(ev.target.value) }))} className="text-xs border border-gray-200 dark:border-[#30363D] dark:bg-[#1C2128] rounded-md px-1 py-1.5"><option value={1}>P1</option><option value={2}>P2</option></select>
                      <select value={newTopic.section} onChange={ev => setNewTopic(v => ({ ...v, section: ev.target.value }))} className="text-xs border border-gray-200 dark:border-[#30363D] dark:bg-[#1C2128] rounded-md px-1 py-1.5"><option value="A">A</option><option value="B">B</option></select>
                      <button
                        onClick={async () => { if (await run('add-' + e.id, { action: 'addTopic', examId: e.id, name: newTopic.name, topic_number: newTopic.number, paper: newTopic.paper, section: newTopic.section, sectionId: newTopic.sectionId }, 'Topic added')) setNewTopic({ name: '', number: '', paper: 2, section: 'B', sectionId: '' }) }}
                        disabled={busy !== null || !newTopic.name.trim() || !newTopic.number.trim() || !newTopic.sectionId}
                        className="inline-flex items-center gap-1 text-xs font-medium text-white bg-brand-600 px-2 py-1.5 rounded-md hover:bg-brand-800 disabled:opacity-40"
                      >
                        <Plus size={12} /> Add
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}

function ShiftRow({ shift, busy, run }: { shift: AdminShiftType; busy: string | null; run: (k: string, b: Record<string, unknown>, ok: string, c?: ConfirmOptions) => Promise<boolean> }) {
  const [start, setStart] = useState(shift.study_start)
  const [end, setEnd] = useState(shift.study_end)
  const dirty = start !== shift.study_start || end !== shift.study_end
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm font-medium text-gray-700 dark:text-gray-300 w-16">Shift {shift.type}</span>
      <input type="time" value={start} onChange={e => setStart(e.target.value)} className="text-xs tabular-nums border border-gray-200 dark:border-[#30363D] dark:bg-[#1C2128] rounded-md px-2 py-1.5 focus:outline-none" />
      <span className="text-gray-400 text-xs">–</span>
      <input type="time" value={end} onChange={e => setEnd(e.target.value)} className="text-xs tabular-nums border border-gray-200 dark:border-[#30363D] dark:bg-[#1C2128] rounded-md px-2 py-1.5 focus:outline-none" />
      <button
        onClick={() => run('shift-' + shift.type, { action: 'updateShiftType', type: shift.type, study_start: start, study_end: end }, 'Shift window updated', { title: 'Update shift window?', message: `Shift ${shift.type} study window will change to ${start}–${end} for everyone.`, confirmLabel: 'Update' })}
        disabled={busy !== null || !dirty}
        className="ml-auto text-xs font-medium text-white bg-brand-600 px-3 py-1.5 rounded-md hover:bg-brand-800 disabled:opacity-40"
      >
        {busy === 'shift-' + shift.type ? <Loader2 size={12} className="animate-spin" /> : 'Save'}
      </button>
    </div>
  )
}
