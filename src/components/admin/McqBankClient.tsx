'use client'

import { useEffect, useMemo, useState } from 'react'
import { Loader2, Upload, Trash2, Download } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import { parseMcqInput, CSV_TEMPLATE, JSON_TEMPLATE } from '@/lib/mcq'
import type { AdminExam, AdminTopicBrief, AdminSubtopicBrief } from '@/lib/admin'

interface BankRow { id: string; question: string; correct: string; difficulty: string; subtopic_id: string | null }

export function McqBankClient({ exams, topics, subtopics }: { exams: AdminExam[]; topics: AdminTopicBrief[]; subtopics: AdminSubtopicBrief[] }) {
  const confirm = useConfirm()
  const [examId, setExamId] = useState(exams[0]?.id ?? '')
  const [topicId, setTopicId] = useState('')
  const [subtopicId, setSubtopicId] = useState('')
  const [format, setFormat] = useState<'json' | 'csv'>('json')
  const [text, setText] = useState('')
  const [importing, setImporting] = useState(false)
  const [rows, setRows] = useState<BankRow[]>([])
  const [loadingList, setLoadingList] = useState(false)

  const examTopics = useMemo(() => topics.filter(t => t.exam_id === examId), [topics, examId])
  const topicSubtopics = useMemo(() => subtopics.filter(s => s.topic_id === topicId), [subtopics, topicId])

  const preview = useMemo(() => (text.trim() ? parseMcqInput(text, format) : { rows: [], errors: [] }), [text, format])

  async function loadList(tid: string) {
    if (!tid) { setRows([]); return }
    setLoadingList(true)
    const res = await fetch('/api/admin/mcq', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'list', topicId: tid }) })
    const json = await res.json().catch(() => ({}))
    setRows(json.questions ?? [])
    setLoadingList(false)
  }
  useEffect(() => { loadList(topicId) }, [topicId])

  async function doImport() {
    if (!topicId) { toast.error('Pick a topic'); return }
    if (preview.rows.length === 0) { toast.error('Nothing valid to import'); return }
    if (!(await confirm({ title: `Import ${preview.rows.length} questions?`, message: 'They will be added to the bank for the selected topic.', confirmLabel: 'Import' }))) return
    setImporting(true)
    const res = await fetch('/api/admin/mcq', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'import', topicId, subtopicId: subtopicId || null, text, format }),
    })
    const json = await res.json().catch(() => ({}))
    setImporting(false)
    if (!res.ok) { toast.error(json.error ?? 'Import failed'); return }
    toast.success(`Imported ${json.imported}${json.skipped ? ` · skipped ${json.skipped}` : ''}`)
    setText('')
    loadList(topicId)
  }

  async function remove(id: string) {
    if (!(await confirm({ title: 'Delete question?', message: 'This permanently removes it from the bank.', confirmLabel: 'Delete', danger: true }))) return
    setRows(prev => prev.filter(r => r.id !== id))
    await fetch('/api/admin/mcq', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'delete', id }) })
  }

  const subName = (id: string | null) => id ? (subtopics.find(s => s.id === id)?.name ?? '') : ''

  return (
    <div className="space-y-4">
      {/* Target */}
      <section className="bg-white dark:bg-[#161B22] border border-gray-200 dark:border-[#30363D] rounded-xl p-4">
        <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">Target</p>
        <div className="grid sm:grid-cols-3 gap-2">
          <select value={examId} onChange={e => { setExamId(e.target.value); setTopicId(''); setSubtopicId('') }} className="text-sm border border-gray-200 dark:border-[#30363D] dark:bg-[#1C2128] dark:text-gray-200 rounded-lg px-2 py-2 focus:outline-none">
            {exams.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
          <select value={topicId} onChange={e => { setTopicId(e.target.value); setSubtopicId('') }} className="text-sm border border-gray-200 dark:border-[#30363D] dark:bg-[#1C2128] dark:text-gray-200 rounded-lg px-2 py-2 focus:outline-none">
            <option value="">Topic…</option>
            {examTopics.map(t => <option key={t.id} value={t.id}>{t.topic_number}. {t.name}</option>)}
          </select>
          <select value={subtopicId} onChange={e => setSubtopicId(e.target.value)} disabled={!topicSubtopics.length} className="text-sm border border-gray-200 dark:border-[#30363D] dark:bg-[#1C2128] dark:text-gray-200 rounded-lg px-2 py-2 focus:outline-none disabled:opacity-50">
            <option value="">Whole topic</option>
            {topicSubtopics.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
      </section>

      {/* Import */}
      <section className="bg-white dark:bg-[#161B22] border border-gray-200 dark:border-[#30363D] rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Bulk import</p>
          <div className="flex items-center gap-1 bg-gray-100 dark:bg-[#1C2128] rounded-lg p-0.5">
            {(['json', 'csv'] as const).map(f => (
              <button key={f} onClick={() => setFormat(f)} className={cn('px-3 py-1 text-xs font-medium rounded-md uppercase', format === f ? 'bg-white dark:bg-[#161B22] text-gray-900 dark:text-gray-100 shadow-sm' : 'text-gray-500')}>{f}</button>
            ))}
          </div>
        </div>
        <button
          onClick={() => setText(format === 'json' ? JSON_TEMPLATE : CSV_TEMPLATE)}
          className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-800 mb-2"
        >
          <Download size={12} /> Insert {format.toUpperCase()} template
        </button>
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          rows={10}
          placeholder={format === 'json' ? 'Paste a JSON array of questions…' : 'Paste CSV: question,A,B,C,D,correct,explanation,difficulty'}
          className="w-full text-xs font-mono text-gray-700 dark:text-gray-200 dark:bg-[#0D1117] border border-gray-200 dark:border-[#30363D] rounded-lg p-3 resize-y focus:outline-none focus:ring-2 focus:ring-brand-400/30"
        />
        {text.trim() && (
          <div className="mt-2 text-xs">
            <p className="text-gray-500"><span className="text-success-600 font-medium">{preview.rows.length} valid</span>{preview.errors.length > 0 && <span className="text-red-500"> · {preview.errors.length} error(s)</span>}</p>
            {preview.errors.slice(0, 5).map((e, i) => <p key={i} className="text-red-500">{e}</p>)}
          </div>
        )}
        <div className="flex justify-end mt-3">
          <button
            onClick={doImport}
            disabled={importing || !topicId || preview.rows.length === 0}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-white bg-brand-600 px-4 py-2 rounded-lg hover:bg-brand-800 transition-colors disabled:opacity-40"
          >
            {importing ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />} Import to bank
          </button>
        </div>
      </section>

      {/* Existing questions */}
      <section className="bg-white dark:bg-[#161B22] border border-gray-200 dark:border-[#30363D] rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Bank {topicId ? `· ${rows.length}` : ''}</p>
        </div>
        {!topicId ? (
          <p className="text-xs text-gray-400 py-4 text-center">Pick a topic to view its questions.</p>
        ) : loadingList ? (
          <Loader2 size={16} className="animate-spin text-gray-400 mx-auto my-4" />
        ) : rows.length === 0 ? (
          <p className="text-xs text-gray-400 py-4 text-center">No questions yet for this topic.</p>
        ) : (
          <div className="space-y-1.5">
            {rows.map(r => (
              <div key={r.id} className="flex items-start gap-3 text-xs py-1.5 border-b border-gray-50 dark:border-[#21262D] last:border-0">
                <span className="text-gray-700 dark:text-gray-300 flex-1">{r.question}</span>
                <span className="text-gray-400 flex-shrink-0">{r.correct} · {r.difficulty}{r.subtopic_id ? ` · ${subName(r.subtopic_id)}` : ''}</span>
                <button onClick={() => remove(r.id)} className="text-gray-300 hover:text-red-500 flex-shrink-0"><Trash2 size={13} /></button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
