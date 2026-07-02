'use client'

import { useEffect, useMemo, useState } from 'react'
import { Loader2, Upload, Trash2, Download, Sparkles, Check } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import { notifyTokens, tokensFromRes } from '@/lib/notify-tokens'
import { parseMcqInput, CSV_TEMPLATE, JSON_TEMPLATE } from '@/lib/mcq'
import { OPENROUTER_MODELS } from '@/lib/openrouter-models'

interface BankRow { id: string; question: string; correct: string; difficulty: string; subtopic_id: string | null }
interface SubRef { id: string; name: string }
interface GenQ { question: string; options: Record<string, string>; correct: string; explanation?: string }

const COUNTS = [5, 10, 20]
const DIFFS = ['mixed', 'easy', 'medium', 'hard'] as const

async function api(body: Record<string, unknown>) {
  const res = await fetch('/api/admin/mcq', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) { toast.error(json.error ?? 'Failed'); return null }
  return json
}

export function TopicMcqManager({ topicId, topicName }: { topicId: string; topicName: string }) {
  const confirm = useConfirm()
  const [subtopics, setSubtopics] = useState<SubRef[]>([])
  const [subtopicId, setSubtopicId] = useState('')

  // AI generation
  const [genCount, setGenCount] = useState(5)
  const [genDiff, setGenDiff] = useState<typeof DIFFS[number]>('mixed')
  const [provider, setProvider] = useState<'groq' | 'openrouter'>('groq')
  const [orModel, setOrModel] = useState(OPENROUTER_MODELS[0]?.id ?? '')
  const [generating, setGenerating] = useState(false)
  const [genQs, setGenQs] = useState<GenQ[] | null>(null)
  const [genPick, setGenPick] = useState<Set<number>>(new Set())
  const [format, setFormat] = useState<'json' | 'csv'>('json')
  const [text, setText] = useState('')
  const [importing, setImporting] = useState(false)
  const [rows, setRows] = useState<BankRow[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const preview = useMemo(() => (text.trim() ? parseMcqInput(text, format) : { rows: [], errors: [] }), [text, format])

  async function load() {
    setLoading(true)
    const json = await api({ action: 'list', topicId })
    setRows(json?.questions ?? [])
    setSelected(new Set())
    setLoading(false)
  }
  // Fetch the topic's CURRENT subtopics (so the dropdown reflects adds/deletes, not the stale page load).
  async function loadSubtopics() {
    const res = await fetch('/api/admin/subtopics', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'list', topicId }) })
    const json = await res.json().catch(() => ({}))
    const subs: SubRef[] = json.subtopics ?? []
    setSubtopics(subs)
    setSubtopicId(prev => (prev && !subs.some(s => s.id === prev) ? '' : prev))
  }
  // eslint-disable-next-line react-hooks/set-state-in-effect, react-hooks/exhaustive-deps
  useEffect(() => { load(); loadSubtopics() }, [topicId])

  async function doImport() {
    if (preview.rows.length === 0) { toast.error('Nothing valid to import'); return }
    if (!(await confirm({ title: `Import ${preview.rows.length} questions?`, message: 'Added to this topic’s MCQ bank.', confirmLabel: 'Import' }))) return
    setImporting(true)
    const json = await api({ action: 'import', topicId, subtopicId: subtopicId || null, text, format })
    setImporting(false)
    if (!json) return
    toast.success(`Imported ${json.imported}${json.skipped ? ` · skipped ${json.skipped}` : ''}`)
    setText(''); load()
  }

  async function generate() {
    setGenerating(true); setGenQs(null)
    const sub = subtopics.find(s => s.id === subtopicId)
    const res = await fetch('/api/ai/generate-mcq', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        topicName: sub ? `${topicName} — ${sub.name}` : topicName,
        subtopicName: sub?.name,
        subsections: sub ? [sub.name] : [],
        difficulty: genDiff, count: genCount, provider,
        topicId, subtopicId: subtopicId || undefined,
        grounding: 'source',
        openrouterModel: provider === 'openrouter' ? orModel : undefined,
      }),
    })
    const json = await res.json().catch(() => ({}))
    setGenerating(false)
    notifyTokens(tokensFromRes(res))
    if (!res.ok) { toast.error(json.error ?? 'Generation failed'); return }
    const qs: GenQ[] = (json.questions ?? []).filter((q: GenQ) => q?.question && q?.options)
    if (qs.length === 0) { toast.error('No questions generated'); return }
    setGenQs(qs)
    setGenPick(new Set(qs.map((_, i) => i)))
  }

  async function saveGenerated() {
    if (!genQs) return
    const questions = genQs.filter((_, i) => genPick.has(i))
    if (questions.length === 0) return
    const json = await api({ action: 'insertMany', topicId, subtopicId: subtopicId || null, questions, difficulty: genDiff })
    if (!json) return
    toast.success(`Saved ${json.inserted} to bank`)
    setGenQs(null); setGenPick(new Set()); load()
  }

  async function remove(id: string) {
    if (!(await confirm({ title: 'Delete question?', confirmLabel: 'Delete', danger: true }))) return
    setRows(prev => prev.filter(r => r.id !== id))
    await api({ action: 'delete', id })
  }
  async function deleteSelected() {
    const ids = [...selected]
    if (ids.length === 0) return
    if (!(await confirm({ title: `Delete ${ids.length} question${ids.length > 1 ? 's' : ''}?`, confirmLabel: 'Delete', danger: true }))) return
    setRows(prev => prev.filter(r => !selected.has(r.id))); setSelected(new Set())
    await api({ action: 'deleteMany', ids })
  }
  async function deleteAll() {
    if (rows.length === 0) return
    if (!(await confirm({ title: `Delete all ${rows.length} questions?`, message: 'Every MCQ for this topic will be removed.', confirmLabel: 'Delete all', danger: true }))) return
    await api({ action: 'deleteAll', topicId }); setRows([]); setSelected(new Set()); toast.success('All questions deleted')
  }

  const subName = (id: string | null) => id ? (subtopics.find(s => s.id === id)?.name ?? '') : ''

  return (
    <div className="mt-2 border border-gray-200 dark:border-[#30363D] rounded-lg p-2.5 bg-gray-50 dark:bg-[#0D1117] space-y-3">
      {/* Import */}
      <div>
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <span className="text-[11px] font-medium text-gray-500">MCQ bank</span>
          <div className="flex items-center gap-1.5">
            <select value={subtopicId} onChange={e => setSubtopicId(e.target.value)} disabled={!subtopics.length} className="text-[11px] border border-gray-200 dark:border-[#30363D] dark:bg-[#1C2128] rounded px-1.5 py-1 focus:outline-none disabled:opacity-50 max-w-[120px]">
              <option value="">Whole topic</option>
              {subtopics.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <div className="flex items-center gap-0.5 bg-gray-100 dark:bg-[#1C2128] rounded p-0.5">
              {(['json', 'csv'] as const).map(f => (
                <button key={f} onClick={() => setFormat(f)} className={cn('px-2 py-0.5 text-[10px] font-medium rounded uppercase', format === f ? 'bg-white dark:bg-[#161B22] text-gray-900 dark:text-gray-100 shadow-sm' : 'text-gray-500')}>{f}</button>
              ))}
            </div>
          </div>
        </div>
        <button onClick={() => setText(format === 'json' ? JSON_TEMPLATE : CSV_TEMPLATE)} className="inline-flex items-center gap-1 text-[11px] text-brand-600 hover:text-brand-800 mb-1.5"><Download size={11} /> Template</button>
        <textarea value={text} onChange={e => setText(e.target.value)} rows={5} placeholder={format === 'json' ? 'Paste JSON array…' : 'question,A,B,C,D,correct,explanation,difficulty'} className="w-full text-[11px] font-mono text-gray-700 dark:text-gray-200 dark:bg-[#0D1117] border border-gray-200 dark:border-[#30363D] rounded p-2 resize-y focus:outline-none" />
        {text.trim() && (
          <p className="text-[11px] mt-1">
            <span className="text-success-600 font-medium">{preview.rows.length} valid</span>
            {preview.errors.length > 0 && <span className="text-red-500"> · {preview.errors.length} error(s): {preview.errors[0]}</span>}
          </p>
        )}
        <button onClick={doImport} disabled={importing || preview.rows.length === 0} className="mt-1.5 inline-flex items-center gap-1.5 text-xs font-medium text-white bg-brand-600 px-3 py-1.5 rounded-md hover:bg-brand-800 disabled:opacity-40">
          {importing ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />} Import
        </button>
      </div>

      {/* AI generate (from uploaded source, scoped to the selected subtopic) */}
      <div className="border-t border-gray-200 dark:border-[#21262D] pt-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-medium text-gray-500">AI generate{subtopicId ? ` · ${subtopics.find(s => s.id === subtopicId)?.name ?? ''}` : ' · whole topic'}</span>
          <select value={genCount} onChange={e => setGenCount(Number(e.target.value))} className="text-[11px] border border-gray-200 dark:border-[#30363D] dark:bg-[#1C2128] rounded px-1.5 py-1 focus:outline-none">
            {COUNTS.map(c => <option key={c} value={c}>{c} Qs</option>)}
          </select>
          <select value={genDiff} onChange={e => setGenDiff(e.target.value as typeof DIFFS[number])} className="text-[11px] border border-gray-200 dark:border-[#30363D] dark:bg-[#1C2128] rounded px-1.5 py-1 focus:outline-none capitalize">
            {DIFFS.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
          <div className="flex items-center gap-0.5 bg-gray-100 dark:bg-[#1C2128] rounded p-0.5">
            {(['groq', 'openrouter'] as const).map(p => (
              <button key={p} onClick={() => setProvider(p)} className={cn('px-2 py-0.5 text-[10px] font-medium rounded', provider === p ? 'bg-white dark:bg-[#161B22] text-gray-900 dark:text-gray-100 shadow-sm' : 'text-gray-500')}>{p === 'groq' ? 'Groq' : 'OpenRouter'}</button>
            ))}
          </div>
          {provider === 'openrouter' && (
            <select value={orModel} onChange={e => setOrModel(e.target.value)} className="text-[11px] border border-gray-200 dark:border-[#30363D] dark:bg-[#1C2128] rounded px-1.5 py-1 focus:outline-none max-w-[160px]">
              {OPENROUTER_MODELS.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
            </select>
          )}
          <button onClick={generate} disabled={generating} className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 border border-brand-200 dark:border-brand-800 px-2 py-1 rounded-md hover:bg-brand-50 dark:hover:bg-brand-900/20 disabled:opacity-40">
            {generating ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />} Generate from source
          </button>
        </div>
        <p className="text-[10px] text-gray-400 mt-1">Uses the topic/subtopic uploaded source; falls back to general knowledge if none.</p>

        {genQs && (
          <div className="mt-2 space-y-1">
            {genQs.map((q, i) => {
              const on = genPick.has(i)
              return (
                <button key={i} onClick={() => setGenPick(p => { const s = new Set(p); if (s.has(i)) s.delete(i); else s.add(i); return s })}
                  className="w-full flex items-start gap-2 text-left text-[11px]">
                  <span className={cn('mt-0.5 w-3.5 h-3.5 rounded border flex items-center justify-center flex-shrink-0', on ? 'bg-brand-600 border-brand-600' : 'border-gray-300')}>
                    {on && <Check size={9} className="text-white" />}
                  </span>
                  <span className="flex-1 text-gray-700 dark:text-gray-300">{q.question} <span className="text-gray-400">({q.correct})</span></span>
                </button>
              )
            })}
            <div className="flex items-center gap-2 pt-1">
              <button onClick={saveGenerated} disabled={genPick.size === 0} className="text-xs font-medium text-white bg-brand-600 px-2.5 py-1.5 rounded-md hover:bg-brand-800 disabled:opacity-40">Save {genPick.size} to bank</button>
              <button onClick={() => { setGenQs(null); setGenPick(new Set()) }} className="text-xs text-gray-400 hover:text-gray-600">Discard</button>
            </div>
          </div>
        )}
      </div>

      {/* List */}
      <div className="border-t border-gray-200 dark:border-[#21262D] pt-2">
        {loading ? (
          <Loader2 size={14} className="animate-spin text-gray-400 mx-auto my-2" />
        ) : rows.length === 0 ? (
          <p className="text-[11px] text-gray-400">No questions yet.</p>
        ) : (
          <>
            <div className="flex items-center gap-2 pb-1 mb-1 border-b border-gray-200 dark:border-[#21262D]">
              <input type="checkbox" checked={selected.size === rows.length} onChange={() => setSelected(selected.size === rows.length ? new Set() : new Set(rows.map(r => r.id)))} className="accent-brand-600" />
              <span className="text-[11px] text-gray-400 flex-1">{rows.length} question{rows.length > 1 ? 's' : ''}</span>
              {selected.size > 0 && <button onClick={deleteSelected} className="inline-flex items-center gap-1 text-[11px] font-medium text-white bg-red-600 px-2 py-0.5 rounded hover:bg-red-700"><Trash2 size={11} /> Delete ({selected.size})</button>}
              <button onClick={deleteAll} className="text-[11px] font-medium text-red-600 hover:underline">Delete all</button>
            </div>
            <div className="space-y-1">
              {rows.map(r => (
                <div key={r.id} className="flex items-start gap-2 text-[11px]">
                  <input type="checkbox" checked={selected.has(r.id)} onChange={() => setSelected(p => { const s = new Set(p); if (s.has(r.id)) s.delete(r.id); else s.add(r.id); return s })} className="mt-0.5 accent-brand-600 flex-shrink-0" />
                  <span className="text-gray-700 dark:text-gray-300 flex-1 truncate">{r.question}</span>
                  <span className="text-gray-400 flex-shrink-0">{r.correct} · {r.difficulty}{r.subtopic_id ? ` · ${subName(r.subtopic_id)}` : ''}</span>
                  <button onClick={() => remove(r.id)} className="text-gray-300 hover:text-red-500 flex-shrink-0"><Trash2 size={11} /></button>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
