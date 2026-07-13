'use client'

import { useState, useEffect, useRef } from 'react'
import { BookOpen, PenLine, Layers, RefreshCw, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Markdown } from '@/components/ui/Markdown'
import { SimplifiableContent } from '@/components/shared/SimplifiableContent'
import { ScrollToTop } from '@/components/shared/ScrollToTop'
import { LoadingStream, StreamingSkeleton } from '@/components/shared/LoadingStream'
import { Flashcards } from '@/components/shared/Flashcards'
import { GKDrillPanel } from '@/components/gk/GKDrillPanel'
import { createClient } from '@/lib/supabase/client'
import { readStream } from '@/lib/sse'
import { notifyTokens } from '@/lib/notify-tokens'
import { useHighlighter } from '@/hooks/useHighlighter'
import { useResumeReading, type SavedPosition } from '@/hooks/useResumeReading'
import { useStudyActivityTracker } from '@/hooks/useStudyActivityTracker'
import { HighlightPopover } from '@/components/shared/HighlightPopover'
import { ResumeBanner } from '@/components/shared/ResumeBanner'
import { recordStudyEvent } from '@/lib/study-events'
import type { Topic, Subtopic, UserAnnotation } from '@/types/database'

type SubTab = 'study' | 'practice' | 'flashcards'
type StudyTab = 'source' | 'note' | 'keypoints'

export function SubtopicDetail({ topic, subtopic, onBack }: { topic: Topic; subtopic: Subtopic; onBack: () => void }) {
  const [note, setNote] = useState<Subtopic>(subtopic)
  const [subTab, setSubTab] = useState<SubTab>('study')
  const [studyTab, setStudyTab] = useState<StudyTab>(subtopic.official_source ? 'source' : 'note')
  const [generating, setGenerating] = useState(false)
  const [streamText, setStreamText] = useState('')
  const [refreshing, setRefreshing] = useState(false)
  const [digest, setDigest] = useState('')
  const [showDigest, setShowDigest] = useState(false)

  // Highlighting + resume-reading (subtopic-scoped)
  const [annotations, setAnnotations] = useState<UserAnnotation[]>([])
  const readerRef = useRef<HTMLDivElement>(null)
  const [resume, setResume] = useState<SavedPosition | null>(null)
  const storageKey = `read:sub:${subtopic.id}`
  useStudyActivityTracker({ topicId: topic.id, subtopicId: subtopic.id, tab: studyTab, enabled: subTab === 'study' })

  useEffect(() => {
    let active = true
    const supabase = createClient()
    supabase.from('user_annotations').select('*').eq('topic_id', topic.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => { if (active) setAnnotations(data ?? []) })
    Promise.resolve().then(() => {
      if (!active) return
      try {
        const raw = localStorage.getItem(storageKey)
        setResume(raw ? JSON.parse(raw) as SavedPosition : null)
      } catch { /* ignore */ }
    })
    return () => { active = false }
  }, [topic.id, subtopic.id, storageKey])

  const { popover, onMouseUp, pick, removeHighlight } = useHighlighter({
    readerRef, tab: studyTab, enabled: subTab === 'study', topicId: topic.id,
    subtopicId: subtopic.id, annotations, setAnnotations, reapplyKey: note,
  })
  const { showResume, dismissResume, continueReading } = useResumeReading({
    enabled: subTab === 'study', tab: studyTab, saved: resume,
    save: (t, scroll) => { try { localStorage.setItem(storageKey, JSON.stringify({ tab: t, scroll })) } catch { /* ignore */ } },
    onResumeTab: (t) => setStudyTab(t as StudyTab),
  })

  async function generateNote() {
    setGenerating(true); setStreamText('')
    try {
      const res = await fetch('/api/ai/generate-note', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topicId: topic.id, topicName: topic.name, paper: topic.paper, section: topic.section, subtopicName: subtopic.name }),
      })
      if (!res.ok) throw new Error('Failed')
      const { text: full, tokens } = await readStream(res, setStreamText)
      notifyTokens(tokens)
      const supabase = createClient()
      await supabase.from('subtopics').update({ study_note: full, generated_at: new Date().toISOString() }).eq('id', subtopic.id)
      void recordStudyEvent({
        topicId: topic.id,
        subtopicId: subtopic.id,
        eventType: 'ai_note',
        source: 'ai',
        metadata: { action: 'generate_subtopic_note' },
      })
      setNote(prev => ({ ...prev, study_note: full }))
      toast.success('Study note ready — extracting key points…')
      try {
        const ext = await fetch('/api/ai/extract-note-sections', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ subtopicId: subtopic.id, studyNote: full }),
        })
        if (ext.ok) { const s = await ext.json(); setNote(prev => ({ ...prev, key_points: s.key_points })) }
      } catch {}
    } catch { toast.error('Failed to generate note') }
    finally { setGenerating(false) }
  }

  async function refreshDynamic() {
    setRefreshing(true)
    try {
      const res = await fetch('/api/ai/refresh-current-affairs', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subtopicId: subtopic.id, digest }),
      })
      const json = await res.json()
      if (json.study_note) {
        setNote(prev => ({ ...prev, study_note: json.study_note, key_points: json.key_points ?? prev.key_points, generated_at: new Date().toISOString() }))
        toast.success('Current affairs refreshed')
        setShowDigest(false); setDigest('')
      } else toast.error('Refresh failed')
    } catch { toast.error('Refresh failed') }
    finally { setRefreshing(false) }
  }

  const hasSource = !!note.official_source
  const studyTabs: { key: StudyTab; label: string }[] = [
    ...(hasSource ? [{ key: 'source' as StudyTab, label: 'Source' }] : []),
    { key: 'note', label: 'Study note' },
    { key: 'keypoints', label: 'Key points' },
  ]

  return (
    <div>
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <button onClick={onBack} className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 mb-2 transition-colors">← {topic.name}</button>
          <h1 className="text-base font-medium text-gray-900 dark:text-gray-100 leading-snug">{subtopic.name}</h1>
          {note.is_dynamic && note.generated_at && (
            <p className="text-[11px] text-gray-400 mt-0.5">Updated {new Date(note.generated_at).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
          )}
        </div>
        {note.is_dynamic && (
          <button onClick={() => setShowDigest(s => !s)} className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-brand-600 border border-brand-200 dark:border-brand-800 rounded-lg hover:bg-brand-50 dark:hover:bg-brand-900/20 transition-colors">
            <RefreshCw size={13} /> Refresh
          </button>
        )}
      </div>

      {showDigest && (
        <div className="mb-4 border border-gray-200 dark:border-[#30363D] rounded-xl p-4 bg-gray-50 dark:bg-[#1C2128]">
          <p className="text-xs text-gray-500 mb-2">Paste a recent news digest to ground the refresh (optional but recommended for accuracy).</p>
          <textarea value={digest} onChange={e => setDigest(e.target.value)} rows={4} placeholder="Recent headlines / current affairs digest…"
            className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-[#30363D] dark:bg-[#161B22] dark:text-gray-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-brand-400/30" />
          <button onClick={refreshDynamic} disabled={refreshing} className="mt-2 flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-brand-600 rounded-lg hover:bg-brand-800 transition-colors disabled:opacity-50">
            {refreshing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Refresh now
          </button>
        </div>
      )}

      {/* Sub-tabs */}
      <div className="flex bg-gray-100 dark:bg-[#1C2128] rounded-lg p-0.5 mb-5">
        {([
          { key: 'study' as SubTab, icon: BookOpen, label: 'Study' },
          { key: 'practice' as SubTab, icon: PenLine, label: 'Practice' },
          { key: 'flashcards' as SubTab, icon: Layers, label: 'Flashcards' },
        ]).map(m => (
          <button key={m.key} onClick={() => setSubTab(m.key)} className={cn('flex-1 flex items-center justify-center gap-1.5 py-2 text-sm font-medium rounded-md transition-all duration-150', subTab === m.key ? 'bg-white dark:bg-[#161B22] text-gray-900 dark:text-gray-100 shadow-sm' : 'text-gray-500 dark:text-gray-400')}>
            <m.icon size={13} /> {m.label}
          </button>
        ))}
      </div>

      {subTab === 'study' && (
        <div>
          {showResume && <ResumeBanner onContinue={continueReading} onDismiss={dismissResume} />}
          <div className="flex border-b border-gray-200 dark:border-[#30363D] mb-5 overflow-x-auto scrollbar-none">
            {studyTabs.map(t => (
              <button key={t.key} onClick={() => setStudyTab(t.key)} className={cn('flex-shrink-0 px-4 py-2.5 text-sm font-medium transition-all duration-150 border-b-2 -mb-px', studyTab === t.key ? 'text-brand-600 border-brand-600' : 'text-gray-400 border-transparent hover:text-gray-600 dark:hover:text-gray-300')}>
                {t.label}
              </button>
            ))}
          </div>

          <div ref={readerRef} onMouseUp={onMouseUp}>
          {studyTab === 'source' && note.official_source && (
            <SimplifiableContent content={note.official_source} topicName={`${topic.name} — ${subtopic.name}`} />
          )}

          {studyTab === 'note' && (
            <div>
              {!note.study_note && !generating && (
                <div className="py-16 text-center">
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">No study note for this subtopic yet</p>
                  <button onClick={generateNote} className="px-5 py-2.5 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-800 transition-colors active:scale-[0.98]">Generate study note</button>
                </div>
              )}
              {generating && (<div>{streamText ? <LoadingStream text={streamText} streaming className="mb-4" /> : <StreamingSkeleton />}</div>)}
              {!generating && note.study_note && <SimplifiableContent content={note.study_note} topicName={`${topic.name} — ${subtopic.name}`} />}
            </div>
          )}

          {studyTab === 'keypoints' && (
            note.key_points
              ? <Markdown>{note.key_points}</Markdown>
              : <div className="py-12 text-center"><p className="text-sm text-gray-400 mb-1">No key points yet</p><p className="text-xs text-gray-400">Generate the study note to populate this</p></div>
          )}
          </div>
        </div>
      )}

      {subTab === 'practice' && <GKDrillPanel topic={topic} subtopic={{ id: subtopic.id, name: subtopic.name }} />}

      {subTab === 'flashcards' && (
        note.key_points
          ? <Flashcards topics={[topic]} topicKeyPoints={[{ topic_id: topic.id, key_points: note.key_points }]} />
          : <div className="py-12 text-center"><p className="text-sm text-gray-400 mb-1">No flashcards yet</p><p className="text-xs text-gray-400">Generate the study note first</p></div>
      )}

      {popover && <HighlightPopover popover={popover} onPick={pick} onRemove={removeHighlight} />}
      <ScrollToTop />
    </div>
  )
}
