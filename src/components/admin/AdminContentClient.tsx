'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Plus, Trash2, ChevronDown, FileText, Layers, ListChecks, Sparkles, X } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { TopicSourceEditor } from '@/components/admin/TopicSourceEditor'
import { SubtopicManager } from '@/components/admin/SubtopicManager'
import { TopicMcqManager } from '@/components/admin/TopicMcqManager'
import { ExamBuilder, type ExamBuilderPayload } from '@/components/shared/ExamBuilder'
import { useConfirm, type ConfirmOptions } from '@/components/ui/ConfirmDialog'
import type { AdminExam, AdminShiftType, AdminTopicBrief, AdminSectionBrief } from '@/lib/admin'

async function post(body: Record<string, unknown>): Promise<boolean> {
  const res = await fetch('/api/admin/content', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  const json = await res.json()
  if (!res.ok) { toast.error(json.error ?? 'Failed'); return false }
  return true
}

async function postJson<T>(body: Record<string, unknown>): Promise<T | null> {
  const res = await fetch('/api/admin/content', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  const json = await res.json()
  if (!res.ok) { toast.error(json.error ?? 'Failed'); return null }
  return json as T
}

type SectionKind = 'mcq_study' | 'aptitude' | 'written'
const KIND_LABEL: Record<string, string> = { mcq_study: 'MCQ', aptitude: 'Aptitude', written: 'Written' }

export function AdminContentClient({ exams, shiftTypes, topics, sections }: { exams: AdminExam[]; shiftTypes: AdminShiftType[]; topics: AdminTopicBrief[]; sections: AdminSectionBrief[] }) {
  const router = useRouter()
  const confirm = useConfirm()
  const [busy, setBusy] = useState<string | null>(null)
  const [openExam, setOpenExam] = useState<string | null>(null)
  const [sourceTopic, setSourceTopic] = useState<string | null>(null)
  const [subTopic, setSubTopic] = useState<string | null>(null)
  const [mcqTopic, setMcqTopic] = useState<string | null>(null)
  const [newTopic, setNewTopic] = useState({ name: '', number: '', paper: 2, section: 'B', sectionId: '', subtopics: '' })
  const [showNewExam, setShowNewExam] = useState(false)
  const [newExamPublic, setNewExamPublic] = useState(false)
  const [indexing, setIndexing] = useState(false)
  const [indexResult, setIndexResult] = useState<string | null>(null)

  // Backfill the RAG (AI search) index for every topic with content.
  async function rebuildIndex() {
    setIndexing(true); setIndexResult(null)
    try {
      const res = await fetch('/api/ai/ingest', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ all: true }) })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        const msg = json.error ?? `Failed (HTTP ${res.status})`
        toast.error('Failed to rebuild index'); setIndexResult(`❌ ${msg}`)
      } else {
        const errs: string[] = json.errors ?? []
        const msg = `${json.inserted ?? 0} chunks across ${json.topics ?? 0} topics`
        if (errs.length) { toast.error('Index rebuilt with errors'); setIndexResult(`⚠️ ${msg}\n${errs.join('\n')}`) }
        else { toast.success(`AI index rebuilt — ${msg}`); setIndexResult(`✅ ${msg}`) }
      }
    } catch (e) {
      toast.error('Failed to rebuild index'); setIndexResult(`❌ ${String(e)}`)
    } finally {
      setIndexing(false)
    }
  }

  async function run(key: string, body: Record<string, unknown>, ok: string, confirmOpts?: ConfirmOptions) {
    if (confirmOpts && !(await confirm(confirmOpts))) return false
    setBusy(key)
    const success = await post(body)
    setBusy(null)
    if (success) { toast.success(ok); router.refresh() }
    return success
  }

  // Create an exam (admin) then scaffold its sections/topics from the reviewed syllabus.
  async function handleCreateExam(payload: ExamBuilderPayload) {
    const created = await postJson<{ examId: string }>({ action: 'createExam', name: payload.name, body: payload.body, is_public: newExamPublic })
    if (!created?.examId) return
    if (payload.sections.length) {
      try {
        const res = await fetch('/api/ai/scaffold-exam', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ examId: created.examId, examName: payload.name, sections: payload.sections }),
        })
        if (!res.ok) toast.warning('Exam created, but adding topics had trouble — add them below.')
      } catch {
        toast.warning('Exam created, but adding topics had trouble — add them below.')
      }
    }
    toast.success('Exam created')
    setShowNewExam(false); setNewExamPublic(false)
    router.refresh()
  }

  return (
    <div className="space-y-4">
      {/* AI search index */}
      <section className="bg-white dark:bg-[#161B22] border border-gray-200 dark:border-[#30363D] rounded-xl p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">AI search index (RAG)</p>
            <p className="text-xs text-gray-400">Embed all topic notes, sources &amp; annotations so the AI chat retrieves relevant passages.</p>
          </div>
          <button
            onClick={rebuildIndex}
            disabled={indexing}
            className="flex-shrink-0 inline-flex items-center gap-1.5 text-xs font-medium text-white bg-brand-600 px-3 py-2 rounded-lg hover:bg-brand-800 transition-colors disabled:opacity-50"
          >
            {indexing ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />} {indexing ? 'Rebuilding…' : 'Rebuild index'}
          </button>
        </div>
        {indexResult && <p className="mt-2 text-xs font-mono text-gray-600 dark:text-gray-300 break-words whitespace-pre-wrap">{indexResult}</p>}
      </section>

      {/* Shift types */}
      <section className="bg-white dark:bg-[#161B22] border border-gray-200 dark:border-[#30363D] rounded-xl p-4">
        <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">Shift study windows</p>
        <div className="space-y-2">
          {shiftTypes.map(s => <ShiftRow key={s.type} shift={s} busy={busy} run={run} />)}
        </div>
      </section>

      {/* Exams */}
      <section className="bg-white dark:bg-[#161B22] border border-gray-200 dark:border-[#30363D] rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Exams</p>
          <button
            onClick={() => setShowNewExam(v => !v)}
            className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-800 transition-colors"
          >
            {showNewExam ? <><X size={13} /> Close</> : <><Plus size={13} /> New exam</>}
          </button>
        </div>

        {showNewExam && (
          <div className="mb-4 border border-brand-200 dark:border-brand-800 rounded-xl p-4 bg-brand-50/40 dark:bg-brand-900/10">
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-1 flex items-center gap-1.5"><Sparkles size={14} className="text-brand-600" /> Create exam from syllabus</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">Name it, upload or paste a syllabus, and AI will scaffold its sections &amp; topics.</p>
            <ExamBuilder
              onCommit={handleCreateExam}
              onBack={() => { setShowNewExam(false); setNewExamPublic(false) }}
              submitLabel={(n) => `Create exam with ${n} topic${n === 1 ? '' : 's'}`}
              extraFields={
                <label className="flex items-center gap-2 mb-3 text-xs text-gray-600 dark:text-gray-400 cursor-pointer">
                  <input type="checkbox" checked={newExamPublic} onChange={e => setNewExamPublic(e.target.checked)} className="accent-brand-600" />
                  Make public (show in the catalog to all users)
                </label>
              }
            />
          </div>
        )}

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
                  <button
                    onClick={() => run('del-exam-' + e.id, { action: 'deleteExam', examId: e.id }, 'Exam deleted', { title: 'Delete exam?', message: `"${e.name}" and its ${e.sections} section(s), ${e.topics} topic(s) and ${e.enrollments} enrolment(s) will be permanently deleted. This cannot be undone.`, confirmLabel: 'Delete exam', danger: true })}
                    disabled={busy !== null}
                    title="Delete exam"
                    className="flex-shrink-0 p-1.5 rounded-md text-gray-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                  >
                    {busy === 'del-exam-' + e.id ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={14} />}
                  </button>
                </div>

                {open && (
                  <div className="px-3 pb-3 space-y-2 border-t border-gray-100 dark:border-[#21262D] pt-3">
                    {/* Sections */}
                    <SectionsBlock examId={e.id} sections={examSections} busy={busy} run={run} />

                    {/* Topics */}
                    {examTopics.map(t => (
                      <div key={t.id}>
                        <div className="flex items-center gap-2 text-xs">
                          <span className="flex-1 text-gray-700 dark:text-gray-300 truncate">{t.topic_number}. {t.name} <span className="text-gray-400">P{t.paper}{t.section}</span></span>
                          <button
                            onClick={() => { setSubTopic(subTopic === t.id ? null : t.id); setSourceTopic(null); setMcqTopic(null) }}
                            title="Manage subtopics"
                            className={cn('inline-flex items-center px-1.5 py-1 rounded-md transition-colors', subTopic === t.id ? 'text-brand-600 bg-brand-50 dark:bg-brand-900/20' : 'text-gray-300 hover:text-brand-600')}
                          >
                            <Layers size={13} />
                          </button>
                          <button
                            onClick={() => { setMcqTopic(mcqTopic === t.id ? null : t.id); setSubTopic(null); setSourceTopic(null) }}
                            title="Manage MCQ questions"
                            className={cn('inline-flex items-center px-1.5 py-1 rounded-md transition-colors', mcqTopic === t.id ? 'text-brand-600 bg-brand-50 dark:bg-brand-900/20' : 'text-gray-300 hover:text-brand-600')}
                          >
                            <ListChecks size={13} />
                          </button>
                          <button
                            onClick={() => { setSourceTopic(sourceTopic === t.id ? null : t.id); setSubTopic(null); setMcqTopic(null) }}
                            title={t.hasSource ? 'Edit official source' : 'Add official source'}
                            className={cn('inline-flex items-center gap-1 px-1.5 py-1 rounded-md transition-colors', t.hasSource ? 'text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-900/20' : 'text-gray-300 hover:text-brand-600')}
                          >
                            <FileText size={13} />{t.hasSource && <span className="w-1.5 h-1.5 rounded-full bg-brand-500" />}
                          </button>
                          <button onClick={() => run('del-' + t.id, { action: 'deleteTopic', topicId: t.id }, 'Topic deleted', { title: 'Delete topic?', message: `"${t.topic_number}. ${t.name}" and its notes/subtopics will be permanently removed.`, confirmLabel: 'Delete', danger: true })} disabled={busy !== null} className="text-gray-300 hover:text-red-500"><Trash2 size={13} /></button>
                        </div>
                        {subTopic === t.id && <SubtopicManager topicId={t.id} topicName={t.name} />}
                        {mcqTopic === t.id && <TopicMcqManager topicId={t.id} topicName={t.name} />}
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
                        onClick={async () => { if (await run('add-' + e.id, { action: 'addTopic', examId: e.id, name: newTopic.name, topic_number: newTopic.number, paper: newTopic.paper, section: newTopic.section, sectionId: newTopic.sectionId, subtopics: newTopic.subtopics }, 'Topic added')) setNewTopic({ name: '', number: '', paper: 2, section: 'B', sectionId: '', subtopics: '' }) }}
                        disabled={busy !== null || !newTopic.name.trim() || !newTopic.number.trim() || !newTopic.sectionId}
                        className="inline-flex items-center gap-1 text-xs font-medium text-white bg-brand-600 px-2 py-1.5 rounded-md hover:bg-brand-800 disabled:opacity-40"
                      >
                        <Plus size={12} /> Add
                      </button>
                    </div>
                    <textarea
                      value={newTopic.subtopics}
                      onChange={ev => setNewTopic(v => ({ ...v, subtopics: ev.target.value }))}
                      rows={2}
                      placeholder="Optional subtopics — one per line"
                      className="mt-1.5 w-full text-xs border border-gray-200 dark:border-[#30363D] dark:bg-[#1C2128] rounded-md px-2 py-1.5 resize-y focus:outline-none"
                    />
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

type RunFn = (k: string, b: Record<string, unknown>, ok: string, c?: ConfirmOptions) => Promise<boolean>

function SectionsBlock({ examId, sections, busy, run }: { examId: string; sections: AdminSectionBrief[]; busy: string | null; run: RunFn }) {
  const [name, setName] = useState('')
  const [kind, setKind] = useState<SectionKind>('mcq_study')
  return (
    <div className="rounded-md bg-gray-50 dark:bg-[#1C2128] p-2.5 space-y-1.5">
      <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Sections</p>
      {sections.map(s => <SectionRow key={s.id} section={s} busy={busy} run={run} />)}
      {sections.length === 0 && <p className="text-[11px] text-gray-400">No sections yet — add one so topics become visible to users.</p>}
      <div className="flex items-center gap-1.5 pt-1">
        <input value={name} onChange={e => setName(e.target.value)} placeholder="New section name" className="flex-1 min-w-[100px] text-xs border border-gray-200 dark:border-[#30363D] dark:bg-[#161B22] rounded-md px-2 py-1.5 focus:outline-none" />
        <select value={kind} onChange={e => setKind(e.target.value as SectionKind)} className="text-xs border border-gray-200 dark:border-[#30363D] dark:bg-[#161B22] rounded-md px-1 py-1.5">
          <option value="mcq_study">MCQ</option>
          <option value="aptitude">Aptitude</option>
          <option value="written">Written</option>
        </select>
        <button
          onClick={async () => { if (await run('addsec-' + examId, { action: 'addSection', examId, name, kind }, 'Section added')) setName('') }}
          disabled={busy !== null || !name.trim()}
          className="inline-flex items-center gap-1 text-xs font-medium text-white bg-brand-600 px-2 py-1.5 rounded-md hover:bg-brand-800 disabled:opacity-40"
        >
          {busy === 'addsec-' + examId ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />} Add
        </button>
      </div>
    </div>
  )
}

function SectionRow({ section, busy, run }: { section: AdminSectionBrief; busy: string | null; run: RunFn }) {
  const [name, setName] = useState(section.name)
  const [kind, setKind] = useState<SectionKind>((['mcq_study', 'aptitude', 'written'].includes(section.kind) ? section.kind : 'mcq_study') as SectionKind)
  const dirty = name !== section.name || kind !== section.kind
  return (
    <div className="flex items-center gap-1.5">
      <input value={name} onChange={e => setName(e.target.value)} className="flex-1 min-w-[100px] text-xs border border-gray-200 dark:border-[#30363D] dark:bg-[#161B22] rounded-md px-2 py-1.5 focus:outline-none" />
      <select value={kind} onChange={e => setKind(e.target.value as SectionKind)} className="text-xs border border-gray-200 dark:border-[#30363D] dark:bg-[#161B22] rounded-md px-1 py-1.5">
        <option value="mcq_study">MCQ</option>
        <option value="aptitude">Aptitude</option>
        <option value="written">Written</option>
      </select>
      {dirty && (
        <button
          onClick={() => run('sec-' + section.id, { action: 'updateSection', sectionId: section.id, fields: { name, kind } }, 'Section updated')}
          disabled={busy !== null || !name.trim()}
          className="text-xs font-medium text-white bg-brand-600 px-2 py-1.5 rounded-md hover:bg-brand-800 disabled:opacity-40"
        >
          {busy === 'sec-' + section.id ? <Loader2 size={12} className="animate-spin" /> : 'Save'}
        </button>
      )}
      <button
        onClick={() => run('secdel-' + section.id, { action: 'deleteSection', sectionId: section.id }, 'Section deleted', { title: 'Delete section?', message: `"${section.name}" (${KIND_LABEL[section.kind] ?? section.kind}) and all its topics will be permanently deleted. This cannot be undone.`, confirmLabel: 'Delete section', danger: true })}
        disabled={busy !== null}
        title="Delete section"
        className="text-gray-300 hover:text-red-500 flex-shrink-0"
      >
        {busy === 'secdel-' + section.id ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={13} />}
      </button>
    </div>
  )
}
