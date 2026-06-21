'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, GraduationCap, Sparkles, BookOpen, ChevronRight, Check } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { Logo } from '@/components/ui/Logo'

interface CatalogExam { id: string; name: string; body: string | null; description: string | null }
type Step = 'profile' | 'choose' | 'custom'
type Path = 'catalog' | 'custom'

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

  async function finishCustom() {
    if (!customName.trim()) { toast.error('Name your exam'); return }
    setBusy(true)
    const supabase = createClient()
    const userId = (await supabase.auth.getUser()).data.user!.id

    const { data: exam, error } = await supabase.from('exams').insert({
      name: customName.trim(),
      body: customBody.trim() || null,
      is_public: false,
      created_by: userId,
      config: examDate ? { default_exam_date: examDate } : {},
    }).select('id').single()

    if (error || !exam) { toast.error('Failed to create exam'); setBusy(false); return }

    // Scaffold sections + topics from the syllabus (best-effort)
    try {
      await fetch('/api/ai/scaffold-exam', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ examId: exam.id, examName: customName, syllabus }),
      })
    } catch {}

    await supabase.from('profiles').update({ full_name: name, onboarded: true }).eq('id', userId)
    await supabase.from('enrollments').upsert(
      { exam_id: exam.id, exam_date: examDate || null, is_active: true },
      { onConflict: 'user_id,exam_id' }
    )
    if (examDate) await supabase.from('user_settings').upsert({ key: 'exam_date', value: examDate }, { onConflict: 'user_id,key' })
    toast.success('Your exam is ready!')
    router.push('/'); router.refresh()
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
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">Paste a syllabus and AI will scaffold your sections &amp; topics.</p>

          <input value={customName} onChange={e => setCustomName(e.target.value)} placeholder="Exam name (e.g. Lok Sewa Officer)"
            className="w-full px-3 py-2.5 text-sm border border-gray-200 dark:border-[#30363D] dark:bg-[#1C2128] dark:text-gray-200 rounded-lg mb-3 focus:outline-none focus:ring-2 focus:ring-brand-400/30 focus:border-brand-400" />
          <input value={customBody} onChange={e => setCustomBody(e.target.value)} placeholder="Body / field (optional, e.g. Public Service)"
            className="w-full px-3 py-2.5 text-sm border border-gray-200 dark:border-[#30363D] dark:bg-[#1C2128] dark:text-gray-200 rounded-lg mb-3 focus:outline-none focus:ring-2 focus:ring-brand-400/30 focus:border-brand-400" />
          <textarea value={syllabus} onChange={e => setSyllabus(e.target.value)} rows={6} placeholder="Paste your syllabus or list of topics here (optional)…"
            className="w-full px-3 py-2.5 text-sm border border-gray-200 dark:border-[#30363D] dark:bg-[#1C2128] dark:text-gray-200 rounded-lg resize-none mb-4 focus:outline-none focus:ring-2 focus:ring-brand-400/30 focus:border-brand-400" />

          <button onClick={finishCustom} disabled={busy || !customName.trim()}
            className="w-full flex items-center justify-center gap-2 py-3 bg-brand-600 text-white text-sm font-medium rounded-xl hover:bg-brand-800 transition-colors disabled:opacity-50">
            {busy ? <><Loader2 size={15} className="animate-spin" /> Building your exam…</> : <><Sparkles size={15} /> Create &amp; start</>}
          </button>
          <button onClick={() => setStep('choose')} className="mt-3 w-full text-xs text-gray-400 hover:text-gray-600">← Back</button>
        </div>
      )}
    </div>
  )
}
