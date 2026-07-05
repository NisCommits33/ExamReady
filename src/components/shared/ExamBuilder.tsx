'use client'

import { useRef, useState, type ReactNode } from 'react'
import { Loader2, Sparkles, Check, Upload, FileText, X } from 'lucide-react'
import { toast } from 'sonner'
import { readSourceFile } from '@/lib/source-file'
import { notifyTokens, tokensFromRes } from '@/lib/notify-tokens'

type Kind = 'mcq_study' | 'aptitude' | 'written'
interface PreviewTopic { name: string; topic_number: string; paper: number; include: boolean }
interface PreviewSection { name: string; kind: Kind; topics: PreviewTopic[] }

export interface ChosenSection {
  name: string
  kind: Kind
  topics: { name: string; topic_number: string; paper: number }[]
}
export interface ExamBuilderPayload { name: string; body: string; sections: ChosenSection[] }

interface Props {
  /** Persist the built exam. Awaited while the button shows a spinner. */
  onCommit: (payload: ExamBuilderPayload) => Promise<void>
  /** Back out of the builder (e.g. onboarding → choose step, or close admin panel). */
  onBack?: () => void
  /** Label for the final create button given the selected topic count. */
  submitLabel?: (count: number) => string
  /** Extra controls rendered under the name/body inputs (e.g. an admin "Public" toggle). */
  extraFields?: ReactNode
  initialName?: string
  initialBody?: string
}

/**
 * Syllabus → AI-analyzed preview → topic picker → commit. Extracted from OnboardingWizard so
 * both onboarding and the admin panel can build exams from the same pipeline
 * (`/api/ai/analyze-syllabus` + the caller's own persistence via `onCommit`).
 */
export function ExamBuilder({ onCommit, onBack, submitLabel, extraFields, initialName = '', initialBody = '' }: Props) {
  const [step, setStep] = useState<'custom' | 'review'>('custom')
  const [busy, setBusy] = useState(false)

  const [customName, setCustomName] = useState(initialName)
  const [customBody, setCustomBody] = useState(initialBody)
  const [syllabus, setSyllabus] = useState('')
  const [papers, setPapers] = useState<{ name: string; text: string }[]>([])
  const [reading, setReading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<PreviewSection[]>([])

  function buildSyllabus(): string {
    const parts = papers.map((p, i) => `=== PAPER ${i + 1}: ${p.name} ===\n${p.text}`)
    if (syllabus.trim()) parts.push(`=== ADDITIONAL NOTES ===\n${syllabus.trim()}`)
    return parts.join('\n\n')
  }

  async function handleSyllabusFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const list = Array.from(e.target.files ?? [])
    if (fileRef.current) fileRef.current.value = ''
    if (list.length === 0) return
    setReading(true)
    try {
      const loaded: { name: string; text: string }[] = []
      for (const file of list) {
        const text = await readSourceFile(file)
        if (text.trim()) loaded.push({ name: file.name, text })
      }
      if (loaded.length === 0) { toast.error('Those files looked empty'); return }
      setPapers(prev => [...prev, ...loaded])
      if (!customName.trim()) setCustomName(loaded[0].name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').trim())
      toast.success(`Loaded ${loaded.length} paper${loaded.length > 1 ? 's' : ''} — review and create`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not read a file')
    } finally {
      setReading(false)
    }
  }

  async function analyze() {
    if (!customName.trim()) { toast.error('Name your exam'); return }
    const full = buildSyllabus()
    if (full.trim().length < 20) { toast.error('Upload or paste a syllabus first'); return }
    setBusy(true)
    try {
      const res = await fetch('/api/ai/analyze-syllabus', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ examName: customName, syllabus: full }),
      })
      const data = await res.json()
      notifyTokens(tokensFromRes(res))
      if (!res.ok) throw new Error(data.error ?? 'Analysis failed')
      const sections: PreviewSection[] = (data.sections ?? []).map((s: Omit<PreviewSection, 'topics'> & { topics: Omit<PreviewTopic, 'include'>[] }) => ({
        name: s.name, kind: s.kind,
        topics: (s.topics ?? []).map(t => ({ ...t, include: true })),
      }))
      setPreview(sections)
      setStep('review')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not analyze the syllabus')
    } finally { setBusy(false) }
  }

  const selectedCount = preview.reduce((n, s) => n + s.topics.filter(t => t.include).length, 0)
  function setAllTopics(include: boolean) {
    setPreview(prev => prev.map(s => ({ ...s, topics: s.topics.map(t => ({ ...t, include })) })))
  }
  function toggleTopic(si: number, ti: number) {
    setPreview(prev => prev.map((s, i) => i !== si ? s : { ...s, topics: s.topics.map((t, j) => j !== ti ? t : { ...t, include: !t.include }) }))
  }

  async function commit() {
    setBusy(true)
    const sections: ChosenSection[] = preview
      .map(s => ({ name: s.name, kind: s.kind, topics: s.topics.filter(t => t.include).map(({ name, topic_number, paper }) => ({ name, topic_number, paper })) }))
      .filter(s => s.kind === 'aptitude' || s.topics.length > 0)
    try {
      await onCommit({ name: customName.trim(), body: customBody.trim(), sections })
    } finally {
      setBusy(false)
    }
  }

  if (step === 'custom') {
    return (
      <div>
        <input value={customName} onChange={e => setCustomName(e.target.value)} placeholder="Exam name (e.g. Lok Sewa Officer)"
          className="w-full px-3 py-2.5 text-sm border border-gray-200 dark:border-[#30363D] dark:bg-[#1C2128] dark:text-gray-200 rounded-lg mb-3 focus:outline-none focus:ring-2 focus:ring-brand-400/30 focus:border-brand-400" />
        <input value={customBody} onChange={e => setCustomBody(e.target.value)} placeholder="Body / field (optional, e.g. Public Service)"
          className="w-full px-3 py-2.5 text-sm border border-gray-200 dark:border-[#30363D] dark:bg-[#1C2128] dark:text-gray-200 rounded-lg mb-3 focus:outline-none focus:ring-2 focus:ring-brand-400/30 focus:border-brand-400" />

        {extraFields}

        <input ref={fileRef} type="file" multiple accept=".md,.markdown,.txt,.pdf,image/*,text/markdown,text/plain" onChange={handleSyllabusFiles} className="hidden" />
        {papers.length > 0 && (
          <div className="space-y-1.5 mb-3">
            {papers.map((p, i) => (
              <div key={i} className="flex items-center gap-2 px-3 py-2 bg-brand-50 dark:bg-brand-900/15 border border-brand-200 dark:border-brand-800 rounded-lg">
                <FileText size={14} className="text-brand-600 flex-shrink-0" />
                <span className="text-[11px] font-medium text-brand-700 dark:text-brand-400 flex-shrink-0">Paper {i + 1}</span>
                <span className="text-xs text-brand-800 dark:text-brand-300 truncate flex-1">{p.name}</span>
                <button onClick={() => setPapers(prev => prev.filter((_, j) => j !== i))} className="text-brand-500 hover:text-brand-700 flex-shrink-0"><X size={14} /></button>
              </div>
            ))}
          </div>
        )}
        <button onClick={() => fileRef.current?.click()} disabled={reading}
          className="w-full flex items-center justify-center gap-2 py-2.5 mb-3 border-2 border-dashed border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 text-sm font-medium rounded-lg hover:border-brand-400 hover:text-brand-600 transition-all disabled:opacity-50">
          {reading ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />} {reading ? 'Reading files…' : papers.length ? 'Add another paper' : 'Upload paper files (.md, PDF, image)'}
        </button>

        <textarea value={syllabus} onChange={e => setSyllabus(e.target.value)} rows={5} placeholder="…or paste syllabus text here (added alongside any uploaded papers)"
          className="w-full px-3 py-2.5 text-sm border border-gray-200 dark:border-[#30363D] dark:bg-[#1C2128] dark:text-gray-200 rounded-lg resize-none mb-4 focus:outline-none focus:ring-2 focus:ring-brand-400/30 focus:border-brand-400" />

        <button onClick={analyze} disabled={busy || !customName.trim()}
          className="w-full flex items-center justify-center gap-2 py-3 bg-brand-600 text-white text-sm font-medium rounded-xl hover:bg-brand-800 transition-colors disabled:opacity-50">
          {busy ? <><Loader2 size={15} className="animate-spin" /> Analyzing…</> : <><Sparkles size={15} /> Analyze syllabus</>}
        </button>
        {onBack && <button onClick={onBack} className="mt-3 w-full text-xs text-gray-400 hover:text-gray-600">← Back</button>}
      </div>
    )
  }

  // review
  return (
    <div>
      <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-1">Choose your topics</h2>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">Pick the topics to include — grouped by paper. You can add subtopics later.</p>

      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-gray-500">{selectedCount} topic{selectedCount === 1 ? '' : 's'} selected</span>
        <div className="flex gap-2">
          <button onClick={() => setAllTopics(true)} className="text-xs font-medium text-brand-600 hover:text-brand-800">All</button>
          <span className="text-gray-300">·</span>
          <button onClick={() => setAllTopics(false)} className="text-xs font-medium text-gray-400 hover:text-gray-600">None</button>
        </div>
      </div>

      <div className="space-y-4 max-h-[46vh] overflow-y-auto mb-4 pr-1">
        {preview.map((s, si) => (
          <div key={si}>
            <div className="flex items-center gap-2 mb-1.5">
              <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">{s.name}</p>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 dark:bg-[#30363D] text-gray-500">{s.kind === 'aptitude' ? 'Aptitude' : s.kind === 'written' ? 'Written' : 'MCQ'}</span>
            </div>
            {s.topics.length === 0 ? (
              <p className="text-[11px] text-gray-400 pl-1">Practice section — no reading topics</p>
            ) : (
              <div className="space-y-1">
                {s.topics.map((t, ti) => (
                  <label key={ti} className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg hover:bg-gray-50 dark:hover:bg-[#1C2128] cursor-pointer">
                    <input type="checkbox" checked={t.include} onChange={() => toggleTopic(si, ti)} className="accent-brand-600" />
                    <span className="text-[10px] font-medium text-gray-400 w-10 flex-shrink-0">P{t.paper} · {t.topic_number}</span>
                    <span className="text-sm text-gray-800 dark:text-gray-200 truncate">{t.name}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <button onClick={commit} disabled={busy || selectedCount === 0}
        className="w-full flex items-center justify-center gap-2 py-3 bg-brand-600 text-white text-sm font-medium rounded-xl hover:bg-brand-800 transition-colors disabled:opacity-50">
        {busy ? <><Loader2 size={15} className="animate-spin" /> Creating…</> : <><Check size={15} /> {submitLabel ? submitLabel(selectedCount) : `Create exam with ${selectedCount} topic${selectedCount === 1 ? '' : 's'}`}</>}
      </button>
      <button onClick={() => setStep('custom')} className="mt-3 w-full text-xs text-gray-400 hover:text-gray-600">← Back to edit</button>
    </div>
  )
}
