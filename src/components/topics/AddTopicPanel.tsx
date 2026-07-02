'use client'

import { useRef, useState } from 'react'
import { Plus, X, Loader2, Sparkles, PencilLine, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { readSourceFile } from '@/lib/source-file'
import { notifyTokens, tokensFromRes } from '@/lib/notify-tokens'

interface CreatedTopic { id: string; name: string; topic_number: string }
interface PreviewTopic { name: string; topic_number: string; subtopics: string[]; include: boolean }

interface Props {
  sectionId: string
  sectionName?: string
  onCreated: (topics: CreatedTopic[]) => void
  className?: string
}

/** "+ New topic" — create a topic manually or import several from a pasted/uploaded syllabus. */
export function AddTopicPanel({ sectionId, sectionName, onCreated, className }: Props) {
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<'manual' | 'syllabus'>('manual')

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={cn('flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-brand-600 border border-brand-200 dark:border-brand-800 rounded-lg hover:bg-brand-50 dark:hover:bg-brand-900/20 transition-colors', className)}
      >
        <Plus size={15} /> New topic
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/30 p-0 sm:p-4" onClick={() => setOpen(false)}>
          <div
            onClick={e => e.stopPropagation()}
            className="bg-white dark:bg-[#161B22] w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl border border-gray-200 dark:border-[#30363D] max-h-[88vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-[#30363D] sticky top-0 bg-white dark:bg-[#161B22]">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Add topic{sectionName ? ` · ${sectionName}` : ''}</h2>
              <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
            </div>

            <div className="flex gap-1 p-1 mx-4 mt-4 bg-gray-100 dark:bg-[#1C2128] rounded-lg">
              {([['manual', 'Manual', PencilLine], ['syllabus', 'From syllabus', Sparkles]] as const).map(([k, label, Icon]) => (
                <button key={k} onClick={() => setMode(k)} className={cn('flex-1 flex items-center justify-center gap-1.5 py-2 text-sm font-medium rounded-md transition-all', mode === k ? 'bg-white dark:bg-[#161B22] text-gray-900 dark:text-gray-100 shadow-sm' : 'text-gray-500')}>
                  <Icon size={13} /> {label}
                </button>
              ))}
            </div>

            <div className="p-4">
              {mode === 'manual'
                ? <ManualForm sectionId={sectionId} onDone={t => { onCreated(t); setOpen(false) }} />
                : <SyllabusForm sectionId={sectionId} sectionName={sectionName} onDone={t => { onCreated(t); setOpen(false) }} />}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function ManualForm({ sectionId, onDone }: { sectionId: string; onDone: (t: CreatedTopic[]) => void }) {
  const [name, setName] = useState('')
  const [num, setNum] = useState('')
  const [paper, setPaper] = useState<1 | 2>(2)
  const [section, setSection] = useState<'A' | 'B'>('B')
  const [subs, setSubs] = useState('')
  const [saving, setSaving] = useState(false)

  async function save() {
    if (!name.trim()) { toast.error('Topic name required'); return }
    setSaving(true)
    try {
      const subtopics = subs.split('\n').map(s => s.replace(/^[-*\d.)\s]+/, '').trim()).filter(Boolean)
      const res = await fetch('/api/topics/create', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sectionId, topic: { name, topic_number: num, paper, section, subtopics } }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed')
      toast.success('Topic created')
      onDone(data.topics ?? [])
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not create topic')
    } finally { setSaving(false) }
  }

  return (
    <div className="space-y-3">
      <Field label="Topic name">
        <input value={name} onChange={e => setName(e.target.value)} autoFocus placeholder="e.g. Foam & extinguishing agents" className={inputCls} />
      </Field>
      <div className="grid grid-cols-3 gap-2">
        <Field label="Number"><input value={num} onChange={e => setNum(e.target.value)} placeholder="1.1" className={inputCls} /></Field>
        <Field label="Paper">
          <select value={paper} onChange={e => setPaper(Number(e.target.value) as 1 | 2)} className={inputCls}><option value={1}>1</option><option value={2}>2</option></select>
        </Field>
        <Field label="Section">
          <select value={section} onChange={e => setSection(e.target.value as 'A' | 'B')} className={inputCls}><option value="A">A</option><option value="B">B</option></select>
        </Field>
      </div>
      <Field label="Subtopics (one per line, optional)">
        <textarea value={subs} onChange={e => setSubs(e.target.value)} rows={4} placeholder={'ICAO Annexes\nStandards & practices'} className={cn(inputCls, 'resize-y')} />
      </Field>
      <button onClick={save} disabled={saving} className="w-full py-2.5 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-800 transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5">
        {saving && <Loader2 size={14} className="animate-spin" />} Create topic
      </button>
    </div>
  )
}

function SyllabusForm({ sectionId, sectionName, onDone }: { sectionId: string; sectionName?: string; onDone: (t: CreatedTopic[]) => void }) {
  const [text, setText] = useState('')
  const [preview, setPreview] = useState<PreviewTopic[] | null>(null)
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (fileRef.current) fileRef.current.value = ''
    if (!file) return
    setBusy(true)
    try {
      const extracted = await readSourceFile(file)
      if (!extracted.trim()) { toast.error('File was empty'); return }
      setText(prev => (prev.trim() ? `${prev}\n\n${extracted}` : extracted))
      toast.success('Syllabus loaded')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not read file')
    } finally { setBusy(false) }
  }

  async function generate() {
    if (text.trim().length < 20) { toast.error('Paste or upload a syllabus first'); return }
    setBusy(true)
    try {
      const res = await fetch('/api/ai/generate-topics', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ syllabus: text, sectionName }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed')
      notifyTokens(tokensFromRes(res))
      setPreview((data.topics ?? []).map((t: PreviewTopic) => ({ ...t, include: true })))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not generate topics')
    } finally { setBusy(false) }
  }

  async function commit() {
    const chosen = (preview ?? []).filter(t => t.include)
    if (chosen.length === 0) { toast.error('Select at least one topic'); return }
    setBusy(true)
    try {
      const res = await fetch('/api/topics/create', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sectionId, topics: chosen.map(t => ({ name: t.name, topic_number: t.topic_number, subtopics: t.subtopics })) }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed')
      toast.success(`Created ${data.topics?.length ?? 0} topics`)
      onDone(data.topics ?? [])
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not create topics')
    } finally { setBusy(false) }
  }

  if (preview) {
    return (
      <div className="space-y-3">
        <p className="text-xs text-gray-500">{preview.filter(t => t.include).length} of {preview.length} selected</p>
        <div className="space-y-1.5 max-h-[45vh] overflow-y-auto">
          {preview.map((t, i) => (
            <label key={i} className="flex items-start gap-2.5 p-2.5 border border-gray-200 dark:border-[#30363D] rounded-lg cursor-pointer">
              <input type="checkbox" checked={t.include} onChange={e => setPreview(p => p!.map((x, j) => j === i ? { ...x, include: e.target.checked } : x))} className="mt-0.5" />
              <span className="min-w-0">
                <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{t.topic_number}. {t.name}</span>
                {t.subtopics.length > 0 && <span className="block text-xs text-gray-400 truncate">{t.subtopics.join(' · ')}</span>}
              </span>
            </label>
          ))}
        </div>
        <div className="flex gap-2">
          <button onClick={() => setPreview(null)} className="flex-1 py-2.5 text-sm font-medium text-gray-500 border border-gray-200 dark:border-[#30363D] rounded-lg hover:bg-gray-50 dark:hover:bg-[#1C2128]">Back</button>
          <button onClick={commit} disabled={busy} className="flex-1 py-2.5 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-800 disabled:opacity-50 flex items-center justify-center gap-1.5">
            {busy && <Loader2 size={14} className="animate-spin" />} Create selected
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <input ref={fileRef} type="file" accept="image/*,.pdf,.md,.txt" onChange={onFile} className="hidden" />
      <button onClick={() => fileRef.current?.click()} disabled={busy} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-brand-600 border border-brand-200 dark:border-brand-800 rounded-lg hover:bg-brand-50 dark:hover:bg-brand-900/20 disabled:opacity-50">
        <Upload size={13} /> Upload syllabus (PDF / image / text)
      </button>
      <textarea value={text} onChange={e => setText(e.target.value)} rows={8} placeholder="Paste the syllabus here — the AI will structure it into topics and subtopics…" className={cn(inputCls, 'resize-y')} />
      <button onClick={generate} disabled={busy} className="w-full py-2.5 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-800 disabled:opacity-50 flex items-center justify-center gap-1.5">
        {busy ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />} Generate topics
      </button>
    </div>
  )
}

const inputCls = 'w-full text-sm text-gray-800 dark:text-gray-100 bg-transparent border border-gray-200 dark:border-[#30363D] rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-400/30 focus:border-brand-400'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 block">{label}</span>{children}</label>
}
