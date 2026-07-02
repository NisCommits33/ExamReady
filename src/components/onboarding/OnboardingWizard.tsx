'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, GraduationCap, Sparkles, BookOpen, ChevronRight, Check, Upload, FileText, X } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { readSourceFile } from '@/lib/source-file'
import { notifyTokens, tokensFromRes } from '@/lib/notify-tokens'
import { Logo } from '@/components/ui/Logo'

interface CatalogExam { id: string; name: string; body: string | null; description: string | null }
type Step = 'profile' | 'choose' | 'custom' | 'review'
type Kind = 'mcq_study' | 'aptitude' | 'written'
interface PreviewTopic { name: string; topic_number: string; paper: number; include: boolean }
interface PreviewSection { name: string; kind: Kind; topics: PreviewTopic[] }

export function OnboardingWizard({ defaultName, catalog }: { defaultName: string; catalog: CatalogExam[] }) {
  const router = useRouter()
  const [step, setStep] = useState<Step>('profile')
  const [busy, setBusy] = useState(false)

  // profile
  const [name, setName] = useState(defaultName)
  const [persona, setPersona] = useState<'student' | 'employee'>('student')
  const [examDate, setExamDate] = useState('')

  // catalog
  const [selectedExam, setSelectedExam] = useState<string | null>(catalog[0]?.id ?? null)

  // custom
  const [customName, setCustomName] = useState('')
  const [customBody, setCustomBody] = useState('')
  const [syllabus, setSyllabus] = useState('')
  const [papers, setPapers] = useState<{ name: string; text: string }[]>([])
  const [reading, setReading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  // Combine uploaded paper files (with paper markers) + any pasted text into one syllabus for the AI.
  function buildSyllabus(): string {
    const parts = papers.map((p, i) => `=== PAPER ${i + 1}: ${p.name} ===\n${p.text}`)
    if (syllabus.trim()) parts.push(`=== ADDITIONAL NOTES ===\n${syllabus.trim()}`)
    return parts.join('\n\n')
  }

  async function handleSyllabusFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const list = Array.from(e.target.files ?? [])
    if (fileRef.current) fileRef.current.value = '' // allow re-selecting the same files
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
      // Prefill the exam name from the first file if the user hasn't typed one.
      if (!customName.trim()) setCustomName(loaded[0].name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').trim())
      toast.success(`Loaded ${loaded.length} paper${loaded.length > 1 ? 's' : ''} — review and create`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not read a file')
    } finally {
      setReading(false)
    }
  }

  async function finishCatalog() {
    if (!selectedExam) { toast.error('Pick an exam'); return }
    setBusy(true)
    const supabase = createClient()
    await supabase.from('profiles').update({ full_name: name, onboarded: true }).eq('id', (await supabase.auth.getUser()).data.user!.id)
    await supabase.from('enrollments').upsert(
      { exam_id: selectedExam, exam_date: examDate || null, is_active: true },
      { onConflict: 'user_id,exam_id' }
    )
    if (examDate) await supabase.from('user_settings').upsert({ key: 'exam_date', value: examDate }, { onConflict: 'user_id,key' })
    toast.success('You\'re all set!')
    router.push('/'); router.refresh()
  }

  // review
  const [preview, setPreview] = useState<PreviewSection[]>([])

  // Analyze the uploaded/pasted syllabus into a preview the user can pick from (no DB writes yet).
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

  // Create the exam with only the topics the user kept (no subtopics).
  async function createFromSelection() {
    setBusy(true)
    const supabase = createClient()
    const userId = (await supabase.auth.getUser()).data.user!.id

    const chosen = preview
      .map(s => ({ name: s.name, kind: s.kind, topics: s.topics.filter(t => t.include).map(({ name, topic_number, paper }) => ({ name, topic_number, paper })) }))
      .filter(s => s.kind === 'aptitude' || s.topics.length > 0)

    const { data: exam, error } = await supabase.from('exams').insert({
      name: customName.trim(),
      body: customBody.trim() || null,
      is_public: false,
      created_by: userId,
      config: examDate ? { default_exam_date: examDate } : {},
    }).select('id').single()
    if (error || !exam) { toast.error('Failed to create exam'); setBusy(false); return }

    if (chosen.length) {
      try {
        const res = await fetch('/api/ai/scaffold-exam', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ examId: exam.id, examName: customName, sections: chosen }),
        })
        if (!res.ok) toast.warning('Exam created, but saving topics had trouble — you can add them later.')
      } catch {
        toast.warning('Exam created, but saving topics had trouble — you can add them later.')
      }
    }

    await supabase.from('profiles').update({ full_name: name, onboarded: true }).eq('id', userId)
    await supabase.from('enrollments').upsert(
      { exam_id: exam.id, exam_date: examDate || null, is_active: true },
      { onConflict: 'user_id,exam_id' }
    )
    if (examDate) await supabase.from('user_settings').upsert({ key: 'exam_date', value: examDate }, { onConflict: 'user_id,key' })
    toast.success('Your exam is ready!')
    router.push('/'); router.refresh()
  }

  const selectedCount = preview.reduce((n, s) => n + s.topics.filter(t => t.include).length, 0)
  function setAllTopics(include: boolean) {
    setPreview(prev => prev.map(s => ({ ...s, topics: s.topics.map(t => ({ ...t, include })) })))
  }
  function toggleTopic(si: number, ti: number) {
    setPreview(prev => prev.map((s, i) => i !== si ? s : { ...s, topics: s.topics.map((t, j) => j !== ti ? t : { ...t, include: !t.include }) }))
  }

  return (
    <div className="bg-white dark:bg-[#161B22] border border-gray-200 dark:border-[#30363D] rounded-2xl p-6 shadow-sm">
      <div className="flex items-center gap-2 mb-1">
        <Logo size={32} />
        <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">LOKAI</span>
      </div>

      {/* Step 1: Profile */}
      {step === 'profile' && (
        <div>
          <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mt-3 mb-1">Welcome 👋</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">Let&apos;s set up your study space.</p>

          <label className="text-xs font-medium text-gray-500 mb-1.5 block">Your name</label>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Full name"
            className="w-full px-3 py-2.5 text-sm border border-gray-200 dark:border-[#30363D] dark:bg-[#1C2128] dark:text-gray-200 rounded-lg mb-4 focus:outline-none focus:ring-2 focus:ring-brand-400/30 focus:border-brand-400" />

          <label className="text-xs font-medium text-gray-500 mb-1.5 block">I am a…</label>
          <div className="grid grid-cols-2 gap-2 mb-4">
            {(['student', 'employee'] as const).map(p => (
              <button key={p} onClick={() => setPersona(p)}
                className={cn('py-2.5 text-sm font-medium rounded-lg border-2 capitalize transition-all', persona === p ? 'border-brand-600 bg-brand-50 text-brand-800' : 'border-gray-200 dark:border-[#30363D] text-gray-500')}>
                {p}
              </button>
            ))}
          </div>

          <label className="text-xs font-medium text-gray-500 mb-1.5 block">Exam date <span className="text-gray-400 font-normal">(optional)</span></label>
          <input type="date" value={examDate} onChange={e => setExamDate(e.target.value)}
            className="w-full px-3 py-2.5 text-sm border border-gray-200 dark:border-[#30363D] dark:bg-[#1C2128] dark:text-gray-200 rounded-lg mb-5 focus:outline-none" />

          <button onClick={() => setStep('choose')} disabled={!name.trim()}
            className="w-full flex items-center justify-center gap-1.5 py-3 bg-brand-600 text-white text-sm font-medium rounded-xl hover:bg-brand-800 transition-colors disabled:opacity-50">
            Continue <ChevronRight size={15} />
          </button>
        </div>
      )}

      {/* Step 2: Choose path */}
      {step === 'choose' && (
        <div>
          <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mt-3 mb-1">Pick your exam</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">Choose a ready-made exam or build your own.</p>

          {catalog.length > 0 && (
            <div className="mb-4">
              <p className="text-xs font-medium text-gray-500 mb-2 flex items-center gap-1.5"><GraduationCap size={13} /> Catalog</p>
              <div className="space-y-2">
                {catalog.map(ex => (
                  <button key={ex.id} onClick={() => setSelectedExam(ex.id)}
                    className={cn('w-full flex items-center gap-3 px-3 py-3 rounded-xl border-2 text-left transition-all', selectedExam === ex.id ? 'border-brand-600 bg-brand-50 dark:bg-brand-900/20' : 'border-gray-200 dark:border-[#30363D]')}>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{ex.name}</p>
                      <p className="text-xs text-gray-400 truncate">{ex.description ?? ex.body}</p>
                    </div>
                    {selectedExam === ex.id && <Check size={16} className="text-brand-600 flex-shrink-0" />}
                  </button>
                ))}
              </div>
              <button onClick={finishCatalog} disabled={busy || !selectedExam}
                className="mt-3 w-full flex items-center justify-center gap-2 py-3 bg-brand-600 text-white text-sm font-medium rounded-xl hover:bg-brand-800 transition-colors disabled:opacity-50">
                {busy ? <Loader2 size={15} className="animate-spin" /> : <BookOpen size={15} />} Start studying
              </button>
            </div>
          )}

          <div className="flex items-center gap-3 my-4">
            <div className="flex-1 h-px bg-gray-200 dark:bg-[#30363D]" />
            <span className="text-[11px] text-gray-400">or</span>
            <div className="flex-1 h-px bg-gray-200 dark:bg-[#30363D]" />
          </div>

          <button onClick={() => setStep('custom')}
            className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 text-sm font-medium rounded-xl hover:border-brand-400 hover:text-brand-600 transition-all">
            <Sparkles size={15} /> Create my own exam
          </button>
          <button onClick={() => setStep('profile')} className="mt-3 w-full text-xs text-gray-400 hover:text-gray-600">← Back</button>
        </div>
      )}

      {/* Step 3: Custom exam */}
      {step === 'custom' && (
        <div>
          <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mt-3 mb-1">Build your exam</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">Upload a syllabus file (or paste it) and AI will scaffold your sections &amp; topics.</p>

          <input value={customName} onChange={e => setCustomName(e.target.value)} placeholder="Exam name (e.g. Lok Sewa Officer)"
            className="w-full px-3 py-2.5 text-sm border border-gray-200 dark:border-[#30363D] dark:bg-[#1C2128] dark:text-gray-200 rounded-lg mb-3 focus:outline-none focus:ring-2 focus:ring-brand-400/30 focus:border-brand-400" />
          <input value={customBody} onChange={e => setCustomBody(e.target.value)} placeholder="Body / field (optional, e.g. Public Service)"
            className="w-full px-3 py-2.5 text-sm border border-gray-200 dark:border-[#30363D] dark:bg-[#1C2128] dark:text-gray-200 rounded-lg mb-3 focus:outline-none focus:ring-2 focus:ring-brand-400/30 focus:border-brand-400" />

          {/* Upload one or more paper files (.md / PDF / image / text) */}
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
          <button onClick={() => setStep('choose')} className="mt-3 w-full text-xs text-gray-400 hover:text-gray-600">← Back</button>
        </div>
      )}

      {/* Step 4: Review & pick topics */}
      {step === 'review' && (
        <div>
          <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mt-3 mb-1">Choose your topics</h1>
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

          <button onClick={createFromSelection} disabled={busy || selectedCount === 0}
            className="w-full flex items-center justify-center gap-2 py-3 bg-brand-600 text-white text-sm font-medium rounded-xl hover:bg-brand-800 transition-colors disabled:opacity-50">
            {busy ? <><Loader2 size={15} className="animate-spin" /> Creating…</> : <><Check size={15} /> Create exam with {selectedCount} topic{selectedCount === 1 ? '' : 's'}</>}
          </button>
          <button onClick={() => setStep('custom')} className="mt-3 w-full text-xs text-gray-400 hover:text-gray-600">← Back to edit</button>
        </div>
      )}
    </div>
  )
}
