'use client'

import { useState, useEffect, useRef, type ReactNode } from 'react'
import { BookOpen, PenLine, MessageSquare, Plus, ChevronRight, Layers, RefreshCw, Upload, Loader2, Pencil } from 'lucide-react'
import { toast } from 'sonner'
import { cn, relativeDate } from '@/lib/utils'
import { ChatPanel } from '@/components/ai/ChatPanel'
import { Markdown } from '@/components/ui/Markdown'
import { SimplifiableContent } from '@/components/shared/SimplifiableContent'
import { LoadingStream, StreamingSkeleton } from '@/components/shared/LoadingStream'
import { StatusToggle } from '@/components/shared/StatusToggle'
import { SubtopicDetail } from '@/components/shared/SubtopicDetail'
import { fetchSubtopics } from '@/lib/subtopics'
import { createClient } from '@/lib/supabase/client'
import type { Topic, TopicNote, TopicStatus, UserAnnotation, Subtopic } from '@/types/database'

type SubTab = 'study' | 'practice'
type StudyTab = 'source' | 'your_source' | 'note' | 'keypoints' | 'tips'

interface Props {
  topic: Topic
  onBack: () => void
  onStatusChange: (topicId: string, status: TopicStatus) => void
  practiceTab?: ReactNode
  practiceLabel?: string
}

export function TopicDetail({ topic, onBack, onStatusChange, practiceTab, practiceLabel = 'Practice' }: Props) {
  const [topicNote, setTopicNote] = useState<TopicNote | null>(null)
  const [annotations, setAnnotations] = useState<UserAnnotation[]>([])
  const [subTab, setSubTab] = useState<SubTab>('study')
  const [studyTab, setStudyTab] = useState<StudyTab>('note')
  const [generating, setGenerating] = useState(false)
  const [extracting, setExtracting] = useState(false)
  const [streamText, setStreamText] = useState('')
  const [chatOpen, setChatOpen] = useState(false)
  const [annotationText, setAnnotationText] = useState('')
  const [showAnnotation, setShowAnnotation] = useState(false)
  const [status, setStatus] = useState<TopicStatus>(topic.status)
  const [subtopics, setSubtopics] = useState<Subtopic[]>([])
  const [selectedSubtopic, setSelectedSubtopic] = useState<Subtopic | null>(null)

  // User-uploaded source ("Your source" tab)
  const [editingSource, setEditingSource] = useState(false)
  const [sourceDraft, setSourceDraft] = useState('')
  const [uploadingSource, setUploadingSource] = useState(false)
  const [savingSource, setSavingSource] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const [{ data: note }, { data: anns }, subs] = await Promise.all([
        supabase.from('topic_notes').select('*').eq('topic_id', topic.id).maybeSingle(),
        supabase.from('user_annotations').select('*').eq('topic_id', topic.id).order('created_at', { ascending: false }),
        fetchSubtopics(topic.id),
      ])
      setTopicNote(note)
      setAnnotations(anns ?? [])
      setSubtopics(subs)
      if (note?.official_source) setStudyTab('source')
      else setStudyTab('note')
    }
    load()
  }, [topic.id])

  async function generateNote() {
    setGenerating(true); setStreamText('')
    try {
      const res = await fetch('/api/ai/generate-note', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topicId: topic.id, topicName: topic.name, paper: topic.paper, section: topic.section, subsections: topic.subsections }),
      })
      if (!res.ok) throw new Error('Failed')
      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let full = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        for (const line of decoder.decode(value).split('\n')) {
          if (line.startsWith('data: ')) {
            const d = line.slice(6); if (d === '[DONE]') break
            try { full += JSON.parse(d).choices?.[0]?.delta?.content ?? ''; setStreamText(full) } catch {}
          }
        }
      }
      const supabase = createClient()
      await supabase.from('topic_notes').upsert({ topic_id: topic.id, study_note: full, generated_at: new Date().toISOString(), model_used: 'llama-3.3-70b-versatile', updated_at: new Date().toISOString() })
      setTopicNote(prev => ({ ...(prev ?? {} as TopicNote), study_note: full }))
      toast.success('Study note generated — extracting key points…')
      setExtracting(true)
      try {
        const ext = await fetch('/api/ai/extract-note-sections', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ topicId: topic.id, studyNote: full }) })
        if (ext.ok) { const s = await ext.json(); setTopicNote(prev => prev ? { ...prev, key_points: s.key_points, exam_tips: s.exam_tips } : prev); toast.success('Key points and exam tips ready') }
      } catch {} finally { setExtracting(false) }
    } catch { toast.error('Failed to generate note') } finally { setGenerating(false) }
  }

  async function handleStatusChange(s: TopicStatus) {
    setStatus(s); onStatusChange(topic.id, s)
    const supabase = createClient()
    await supabase.from('user_topic_progress').upsert({ topic_id: topic.id, status: s }, { onConflict: 'user_id,topic_id' })
    toast.success('Status updated')
    fetch('/api/ai/replan-schedule', { method: 'POST' }).catch(() => {})
  }

  async function addAnnotation() {
    if (!annotationText.trim()) return
    const supabase = createClient()
    const { data } = await supabase.from('user_annotations').insert({ topic_id: topic.id, content: annotationText.trim(), annotation_type: 'note' }).select().single()
    if (data) { setAnnotations(prev => [data, ...prev]); setAnnotationText(''); setShowAnnotation(false); toast.success('Note added') }
  }

  async function handleSourceFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (e.target) e.target.value = '' // allow re-selecting the same file
    if (!file) return
    setUploadingSource(true)
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch('/api/ai/extract-source', { method: 'POST', body: form })
      const json = await res.json()
      if (!res.ok || !json.text) { toast.error(json.error ?? 'Could not extract text from file'); return }
      setSourceDraft(prev => (prev.trim() ? `${prev.trim()}\n\n${json.text}` : json.text))
      toast.success('Text extracted — review and save')
    } catch { toast.error('Could not extract text from file') } finally { setUploadingSource(false) }
  }

  async function saveSource() {
    setSavingSource(true)
    const value = sourceDraft.trim()
    const supabase = createClient()
    const { error } = await supabase.from('topic_notes').upsert(
      { topic_id: topic.id, official_source_2: value || null, updated_at: new Date().toISOString() },
      { onConflict: 'topic_id' },
    )
    setSavingSource(false)
    if (error) { toast.error('Failed to save source'); return }
    setTopicNote(prev => ({ ...(prev ?? {} as TopicNote), official_source_2: value || null }))
    setEditingSource(false)
    toast.success('Source saved')
  }

  const hasSource = !!topicNote?.official_source
  const studyTabs: { key: StudyTab; label: string }[] = [
    ...(hasSource ? [{ key: 'source' as StudyTab, label: 'Official source' }] : []),
    { key: 'your_source', label: 'Your source' },
    { key: 'note', label: 'AI note' }, { key: 'keypoints', label: 'Key points' }, { key: 'tips', label: 'Exam tips' },
  ]

  if (selectedSubtopic) {
    return <SubtopicDetail topic={topic} subtopic={selectedSubtopic} onBack={() => setSelectedSubtopic(null)} />
  }

  return (
    <div>
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <button onClick={() => { onBack(); setChatOpen(false) }} className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 mb-2 transition-colors">← Back to topics</button>
          <h1 className="text-base font-medium text-gray-900 dark:text-gray-100 leading-snug">{topic.name}</h1>
          <p className="text-xs text-gray-400 mt-0.5">Paper {topic.paper} · §{topic.section} · Topic {topic.topic_number}</p>
        </div>
        <StatusToggle value={status} onChange={handleStatusChange} size="sm" />
      </div>

      {practiceTab && (
        <div className="flex bg-gray-100 dark:bg-[#1C2128] rounded-lg p-0.5 mb-5">
          <button onClick={() => setSubTab('study')} className={cn('flex-1 flex items-center justify-center gap-1.5 py-2 text-sm font-medium rounded-md transition-all duration-150', subTab === 'study' ? 'bg-white dark:bg-[#161B22] text-gray-900 dark:text-gray-100 shadow-sm' : 'text-gray-500 dark:text-gray-400')}><BookOpen size={13} /> Study</button>
          <button onClick={() => setSubTab('practice')} className={cn('flex-1 flex items-center justify-center gap-1.5 py-2 text-sm font-medium rounded-md transition-all duration-150', subTab === 'practice' ? 'bg-white dark:bg-[#161B22] text-gray-900 dark:text-gray-100 shadow-sm' : 'text-gray-500 dark:text-gray-400')}><PenLine size={13} /> {practiceLabel}</button>
        </div>
      )}

      {subTab === 'practice' && practiceTab}

      {(subTab === 'study' || !practiceTab) && (
        <div>
          {subtopics.length > 0 && (
            <div className="mb-5">
              <div className="flex items-center gap-1.5 mb-2">
                <Layers size={13} className="text-brand-500" />
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Subtopics</p>
                <span className="text-[11px] text-gray-400">· {subtopics.length}</span>
              </div>
              <div className="grid sm:grid-cols-2 gap-2">
                {subtopics.map(st => (
                  <button
                    key={st.id}
                    onClick={() => setSelectedSubtopic(st)}
                    className="flex items-center justify-between gap-2 px-3 py-2.5 bg-white dark:bg-[#161B22] border border-gray-200 dark:border-[#30363D] rounded-xl text-left hover:border-brand-400 dark:hover:border-brand-700 transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
                  >
                    <span className="text-sm text-gray-800 dark:text-gray-200 truncate flex items-center gap-1.5">
                      {st.is_dynamic && <RefreshCw size={11} className="text-brand-400 flex-shrink-0" />}
                      {st.name}
                    </span>
                    <span className="flex items-center gap-1.5 flex-shrink-0">
                      {st.study_note && <span className="w-1.5 h-1.5 rounded-full bg-success-400" title="Has study note" />}
                      <ChevronRight size={14} className="text-gray-300 dark:text-gray-600" />
                    </span>
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-gray-400 mt-2">Or read the whole-topic overview below.</p>
            </div>
          )}

          <div className="flex border-b border-gray-200 dark:border-[#30363D] mb-5 overflow-x-auto scrollbar-none">
            {studyTabs.map(t => (
              <button key={t.key} onClick={() => setStudyTab(t.key)} className={cn('flex-shrink-0 px-4 py-2.5 text-sm font-medium transition-all duration-150 border-b-2 -mb-px flex items-center gap-1.5', studyTab === t.key ? 'text-brand-600 border-brand-600' : 'text-gray-400 border-transparent hover:text-gray-600 dark:hover:text-gray-300')}>
                {t.label}
                {extracting && (t.key === 'keypoints' || t.key === 'tips') && <span className="w-3 h-3 border border-gray-300 border-t-brand-400 rounded-full animate-spin" />}
              </button>
            ))}
          </div>

          {studyTab === 'source' && topicNote?.official_source && (
            <SimplifiableContent
              content={topicNote.official_source}
              topicName={topic.name}
              header={
                <div className="mb-4 flex items-center gap-2 px-3 py-2 bg-brand-50 dark:bg-brand-900/20 border border-brand-200 dark:border-brand-800 rounded-lg">
                  <span className="text-[11px] font-semibold text-white bg-brand-600 px-1.5 py-0.5 rounded-full">Official</span>
                  <span className="text-xs text-brand-700 dark:text-brand-300">Original source material for this topic</span>
                </div>
              }
            />
          )}

          {studyTab === 'your_source' && (
            <div>
              {!editingSource && topicNote?.official_source_2 ? (
                <div>
                  <div className="mb-4 flex items-center justify-between gap-2 px-3 py-2 bg-gray-50 dark:bg-[#1C2128] border border-gray-200 dark:border-[#30363D] rounded-lg">
                    <span className="text-xs text-gray-500 dark:text-gray-400">Your own source — grounds AI notes, MCQs &amp; key numbers.</span>
                    <button onClick={() => { setSourceDraft(topicNote.official_source_2 ?? ''); setEditingSource(true) }} className="flex-shrink-0 flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-800 transition-colors"><Pencil size={13} /> Edit</button>
                  </div>
                  <SimplifiableContent content={topicNote.official_source_2} topicName={topic.name} preserveBreaks />
                </div>
              ) : !editingSource ? (
                <div className="py-16 text-center">
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Add your own source material for this topic</p>
                  <button onClick={() => { setSourceDraft(''); setEditingSource(true) }} className="px-5 py-2.5 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-800 transition-colors active:scale-[0.98]">Add source</button>
                </div>
              ) : (
                <div className="border border-gray-200 dark:border-[#30363D] dark:bg-[#161B22] rounded-xl p-4">
                  <input ref={fileInputRef} type="file" accept="image/*,.pdf" onChange={handleSourceFile} className="hidden" />
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <button onClick={() => fileInputRef.current?.click()} disabled={uploadingSource} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-brand-600 border border-brand-200 dark:border-brand-800 rounded-lg hover:bg-brand-50 dark:hover:bg-brand-900/20 transition-colors disabled:opacity-50">
                      {uploadingSource ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
                      {uploadingSource ? 'Extracting…' : 'Upload PDF / image'}
                    </button>
                    <span className="text-xs text-gray-400">or paste below</span>
                  </div>
                  <textarea value={sourceDraft} onChange={e => setSourceDraft(e.target.value)} rows={14} placeholder="Paste your source material here, or upload a PDF/image to extract its text…" className="w-full text-sm font-mono text-gray-700 dark:text-gray-100 dark:bg-transparent border border-gray-200 dark:border-[#30363D] rounded-lg p-3 resize-y focus:outline-none focus:ring-2 focus:ring-brand-400/30 focus:border-brand-400" />
                  <div className="flex justify-end gap-2 mt-3">
                    <button onClick={() => { setEditingSource(false); setSourceDraft(topicNote?.official_source_2 ?? '') }} className="text-xs text-gray-400 px-3 py-1.5 hover:text-gray-600">Cancel</button>
                    <button onClick={saveSource} disabled={savingSource || uploadingSource} className="flex items-center gap-1.5 text-xs font-medium text-white bg-brand-600 px-3 py-1.5 rounded-lg hover:bg-brand-800 transition-colors disabled:opacity-50">
                      {savingSource && <Loader2 size={13} className="animate-spin" />} Save
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {studyTab === 'note' && (
            <div>
              {!topicNote?.study_note && !generating && (
                <div className="py-16 text-center">
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">No study note generated yet</p>
                  <button onClick={generateNote} className="px-5 py-2.5 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-800 transition-colors active:scale-[0.98]">Generate study note</button>
                </div>
              )}
              {generating && (<div>{streamText ? <LoadingStream text={streamText} streaming className="mb-4" /> : <StreamingSkeleton />}</div>)}
              {!generating && topicNote?.study_note && <SimplifiableContent content={topicNote.study_note} topicName={topic.name} />}
              {annotations.length > 0 && (
                <div className="mt-6 pt-4 border-t border-gray-100 dark:border-[#21262D]">
                  <p className="text-xs font-medium text-gray-500 mb-2">Your notes ({annotations.length})</p>
                  <div className="space-y-2">
                    {annotations.map(a => (<div key={a.id} className="bg-gray-50 dark:bg-[#1C2128] rounded-lg px-3 py-2.5"><p className="text-sm text-gray-700 dark:text-gray-300">{a.content}</p><p className="text-xs text-gray-400 mt-1">{relativeDate(a.created_at)}</p></div>))}
                  </div>
                </div>
              )}
              {showAnnotation && (
                <div className="mt-4 border border-gray-200 dark:border-[#30363D] dark:bg-[#161B22] rounded-xl p-4">
                  <textarea value={annotationText} onChange={e => setAnnotationText(e.target.value)} rows={3} placeholder="Add your note…" className="w-full text-sm text-gray-700 dark:text-gray-100 dark:bg-transparent resize-none focus:outline-none" autoFocus />
                  <div className="flex justify-end gap-2 mt-2">
                    <button onClick={() => setShowAnnotation(false)} className="text-xs text-gray-400 px-3 py-1.5 hover:text-gray-600">Cancel</button>
                    <button onClick={addAnnotation} className="text-xs font-medium text-white bg-brand-600 px-3 py-1.5 rounded-lg hover:bg-brand-800 transition-colors">Save</button>
                  </div>
                </div>
              )}
            </div>
          )}

          {studyTab === 'keypoints' && (<div>{extracting ? (<div className="py-12 text-center"><div className="w-5 h-5 border-2 border-gray-200 border-t-brand-600 rounded-full animate-spin mx-auto mb-3" /><p className="text-sm text-gray-400">Extracting key points…</p></div>) : topicNote?.key_points ? <Markdown>{topicNote.key_points}</Markdown> : (<div className="py-12 text-center"><p className="text-sm text-gray-400 mb-1">No key points yet</p><p className="text-xs text-gray-400">Generate the study note to populate this tab automatically</p></div>)}</div>)}

          {studyTab === 'tips' && (<div>{extracting ? (<div className="py-12 text-center"><div className="w-5 h-5 border-2 border-gray-200 border-t-brand-600 rounded-full animate-spin mx-auto mb-3" /><p className="text-sm text-gray-400">Extracting exam tips…</p></div>) : topicNote?.exam_tips ? <Markdown>{topicNote.exam_tips}</Markdown> : (<div className="py-12 text-center"><p className="text-sm text-gray-400 mb-1">No exam tips yet</p><p className="text-xs text-gray-400">Generate the study note to populate this tab automatically</p></div>)}</div>)}

          {(studyTab === 'note' || studyTab === 'source' || studyTab === 'your_source') && (
            <div className="fixed bottom-16 md:bottom-4 left-0 right-0 md:left-60 flex justify-center px-4 pointer-events-none z-30">
              <div className="bg-white dark:bg-[#161B22] border border-gray-200 dark:border-[#30363D] rounded-xl px-3 py-2 flex items-center gap-2 shadow-sm pointer-events-auto">
                <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-brand-600 hover:bg-brand-50 rounded-lg transition-colors" onClick={() => setChatOpen(true)}><MessageSquare size={14} />Ask AI</button>
                <div className="w-px h-4 bg-gray-200 dark:bg-[#30363D]" />
                <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-50 rounded-lg transition-colors" onClick={() => setShowAnnotation(true)}><Plus size={14} />Add note</button>
                <div className="w-px h-4 bg-gray-200 dark:bg-[#30363D]" />
                <button onClick={() => handleStatusChange('done')} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-brand-600 hover:bg-brand-800 rounded-lg transition-colors">Mark done</button>
              </div>
            </div>
          )}
        </div>
      )}

      <ChatPanel open={chatOpen} onClose={() => setChatOpen(false)} topicId={topic.id} topicName={topic.name} />
    </div>
  )
}
