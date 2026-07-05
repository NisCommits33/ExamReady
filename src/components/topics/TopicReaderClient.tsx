'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { ArrowLeft, MessageSquare, Plus, Upload, Loader2, Pencil, BookOpenText, Trash2, X } from 'lucide-react'
import { useChatActions } from '@/components/ai/ChatProvider'
import Link from 'next/link'
import { StatusToggle } from '@/components/shared/StatusToggle'
import { PaperBadge } from '@/components/shared/PaperBadge'
import { LoadingStream, StreamingSkeleton } from '@/components/shared/LoadingStream'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { cn, relativeDate } from '@/lib/utils'
import { Markdown } from '@/components/ui/Markdown'
import { isTextFile, readSourceFile } from '@/lib/source-file'
import { readStream } from '@/lib/sse'
import { notifyTokens } from '@/lib/notify-tokens'
import { SimplifiableContent } from '@/components/shared/SimplifiableContent'
import { ScrollToTop } from '@/components/shared/ScrollToTop'
import { SourceMeta } from '@/components/shared/SourceMeta'
import { RecallTab } from '@/components/topics/RecallTab'
import { ExplainTab } from '@/components/topics/ExplainTab'
import { DrillItTab } from '@/components/topics/DrillItTab'
import { HIGHLIGHT_COLORS, HL_MARK_SELECTOR, applyHighlights, clearHighlights, describeSelection, type StoredHighlight } from '@/lib/highlight'
import type { Topic, TopicNote, UserAnnotation, TopicStatus, ReadingPosition } from '@/types/database'

type Tab = 'source' | 'your_source' | 'note' | 'keypoints' | 'tips' | 'recall' | 'explain' | 'drill'

/** Tabs whose content is plain reading text and therefore highlightable. */
const READING_TABS = new Set<Tab>(['source', 'your_source', 'note', 'keypoints', 'tips'])

/** Floating action popover anchored to a text selection or an existing highlight. */
interface Popover { x: number; y: number; kind: 'create' | 'edit'; hlId?: string }

interface Props {
  topic: Topic
  note: TopicNote | null
  annotations: UserAnnotation[]
  resume: ReadingPosition | null
}

export function TopicReaderClient({ topic, note: initialNote, annotations: initialAnnotations, resume }: Props) {
  const hasSource = !!initialNote?.official_source
  const [tab, setTab] = useState<Tab>(hasSource ? 'source' : 'note')
  const [note, setNote] = useState<TopicNote | null>(initialNote)
  const [annotations, setAnnotations] = useState(initialAnnotations)
  const [status, setStatus] = useState<TopicStatus>(topic.status)
  const { openChat } = useChatActions()
  const [generating, setGenerating] = useState(false)
  const [extracting, setExtracting] = useState(false)
  const [streamText, setStreamText] = useState('')
  const [annotationText, setAnnotationText] = useState('')
  const [showAnnotation, setShowAnnotation] = useState(false)
  const readerRef = useRef<HTMLDivElement>(null)

  // Highlighting + resume-reading
  const [popover, setPopover] = useState<Popover | null>(null)
  const canResume = !!resume && READING_TABS.has((resume.last_read_tab ?? '') as Tab) && (resume.last_read_scroll ?? 0) > 0.05
  const [showResume, setShowResume] = useState(canResume)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // User-uploaded source ("Your source" tab) — per-user, from user_topic_sources
  const [userSource, setUserSource] = useState<string | null>(null)
  const [editingSource, setEditingSource] = useState(false)
  const [sourceDraft, setSourceDraft] = useState('')
  const [uploadingSource, setUploadingSource] = useState(false)
  const [savingSource, setSavingSource] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Load the current user's own source for this topic.
  useEffect(() => {
    let active = true
    createClient().from('user_topic_sources').select('content').eq('topic_id', topic.id).maybeSingle()
      .then(({ data }) => { if (active) setUserSource(data?.content ?? null) })
    return () => { active = false }
  }, [topic.id])

  const tabs: { key: Tab; label: string }[] = [
    ...(hasSource ? [{ key: 'source' as Tab, label: 'Official source' }] : []),
    { key: 'your_source', label: 'Your source' },
    { key: 'note',      label: 'AI note'     },
    { key: 'keypoints', label: 'Key points'  },
    { key: 'tips',      label: 'Exam tips'   },
    { key: 'recall',    label: 'Recall'      },
    { key: 'explain',   label: 'Explain'     },
    { key: 'drill',     label: 'Drill it'    },
  ]

  async function handleSourceFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (e.target) e.target.value = '' // allow re-selecting the same file
    if (!file) return
    setUploadingSource(true)
    try {
      const text = await readSourceFile(file)
      if (!text.trim()) { toast.error('File was empty'); return }
      setSourceDraft(prev => (prev.trim() ? `${prev.trim()}\n\n${text}` : text))
      toast.success(isTextFile(file) ? 'File loaded — review and save' : 'Text extracted — review and save')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not read file')
    } finally {
      setUploadingSource(false)
    }
  }

  async function saveSource() {
    setSavingSource(true)
    const value = sourceDraft.trim()
    const supabase = createClient()
    const { error } = await supabase.from('user_topic_sources').upsert({
      topic_id: topic.id,
      content: value || null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,topic_id' })
    setSavingSource(false)
    if (error) { toast.error('Failed to save source'); return }
    setUserSource(value || null)
    setEditingSource(false)
    toast.success('Source saved')
  }

  async function generateNote() {
    setGenerating(true)
    setStreamText('')
    try {
      const res = await fetch('/api/ai/generate-note', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topicId: topic.id,
          topicName: topic.name,
          paper: topic.paper,
          section: topic.section,
          subsections: topic.subsections,
        }),
      })
      if (!res.ok) throw new Error('Failed')
      const { text: full, tokens } = await readStream(res, setStreamText)
      notifyTokens(tokens)
      const supabase = createClient()
      await supabase.from('topic_notes').upsert({
        topic_id: topic.id,
        study_note: full,
        generated_at: new Date().toISOString(),
        model_used: 'llama-3.3-70b-versatile',
        updated_at: new Date().toISOString(),
      })
      setNote(prev => ({ ...(prev ?? {} as TopicNote), study_note: full }))
      toast.success('Study note generated — extracting key points…')

      // Extract key_points and exam_tips from the generated note in background
      setExtracting(true)
      try {
        const extraction = await fetch('/api/ai/extract-note-sections', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ topicId: topic.id, studyNote: full }),
        })
        if (extraction.ok) {
          const sections = await extraction.json()
          setNote(prev => prev ? { ...prev, key_points: sections.key_points, exam_tips: sections.exam_tips } : prev)
          toast.success('Key points and exam tips ready')
        }
      } catch {
        // non-critical — tabs will show regenerate hint
      } finally {
        setExtracting(false)
      }
    } catch {
      toast.error('Failed to generate note')
    } finally {
      setGenerating(false)
    }
  }

  async function handleStatusChange(s: TopicStatus) {
    setStatus(s)
    const supabase = createClient()
    await supabase.from('user_topic_progress').upsert({ topic_id: topic.id, status: s }, { onConflict: 'user_id,topic_id' })
    toast.success('Status updated')
    fetch('/api/ai/replan-schedule', { method: 'POST' }).catch(() => {})
  }

  async function addAnnotation() {
    if (!annotationText.trim()) return
    const supabase = createClient()
    const { data } = await supabase.from('user_annotations').insert({
      topic_id: topic.id,
      content: annotationText.trim(),
      annotation_type: 'note',
    }).select().single()
    if (data) {
      setAnnotations(prev => [data, ...prev])
      setAnnotationText('')
      setShowAnnotation(false)
      toast.success('Note added')
    }
  }

  // ---- Resume reading: persist tab + scroll fraction as the user reads ----
  const saveProgress = useCallback((t: Tab, scroll: number) => {
    const supabase = createClient()
    void supabase.from('user_topic_progress').upsert(
      { topic_id: topic.id, last_read_tab: t, last_read_scroll: scroll },
      { onConflict: 'user_id,topic_id' },
    )
  }, [topic.id])

  useEffect(() => {
    if (!READING_TABS.has(tab)) return
    const onScroll = () => {
      if (saveTimer.current) clearTimeout(saveTimer.current)
      saveTimer.current = setTimeout(() => {
        const max = document.documentElement.scrollHeight - window.innerHeight
        const frac = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0
        saveProgress(tab, frac)
      }, 700)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      if (saveTimer.current) clearTimeout(saveTimer.current)
    }
  }, [tab, saveProgress])

  function continueReading() {
    const target = (resume?.last_read_tab ?? 'note') as Tab
    setTab(target)
    setShowResume(false)
    // Wait for the target tab's content to render before restoring scroll.
    setTimeout(() => {
      const max = document.documentElement.scrollHeight - window.innerHeight
      window.scrollTo({ top: (resume?.last_read_scroll ?? 0) * max, behavior: 'smooth' })
    }, 90)
  }

  // ---- Highlighting: re-apply stored highlights whenever the tab or content changes ----
  useEffect(() => {
    const root = readerRef.current
    if (!root) return
    if (!READING_TABS.has(tab)) { clearHighlights(root); return }
    const dark = document.documentElement.classList.contains('dark')
    const hls: StoredHighlight[] = annotations
      .filter(a => a.annotation_type === 'highlight' && (a.meta?.tab ?? 'note') === tab)
      .map(a => ({ id: a.id, text: a.content, nth: a.meta?.nth ?? 0, color: a.color }))
    applyHighlights(root, hls, dark)
  }, [tab, annotations, note, generating, extracting])

  // Close the popover on scroll or an outside click.
  useEffect(() => {
    if (!popover) return
    const close = () => setPopover(null)
    const onDown = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest?.('[data-hl-popover]')) setPopover(null)
    }
    window.addEventListener('scroll', close, { passive: true })
    document.addEventListener('mousedown', onDown)
    return () => {
      window.removeEventListener('scroll', close)
      document.removeEventListener('mousedown', onDown)
    }
  }, [popover])

  function onReaderMouseUp(e: React.MouseEvent) {
    if (!READING_TABS.has(tab)) return
    const mark = (e.target as HTMLElement).closest?.(HL_MARK_SELECTOR) as HTMLElement | null
    if (mark) {
      const r = mark.getBoundingClientRect()
      setPopover({ x: r.left + r.width / 2, y: r.top, kind: 'edit', hlId: mark.getAttribute('data-hl-id') ?? undefined })
      return
    }
    const sel = window.getSelection()
    if (!sel || sel.isCollapsed || sel.rangeCount === 0 || !readerRef.current?.contains(sel.anchorNode)) {
      setPopover(null)
      return
    }
    const r = sel.getRangeAt(0).getBoundingClientRect()
    setPopover({ x: r.left + r.width / 2, y: r.top, kind: 'create' })
  }

  async function addHighlight(colorKey: string) {
    const root = readerRef.current
    if (!root) return setPopover(null)
    const desc = describeSelection(root)
    if (!desc) return setPopover(null)
    const supabase = createClient()
    const { data } = await supabase.from('user_annotations').insert({
      topic_id: topic.id,
      content: desc.text,
      annotation_type: 'highlight',
      color: colorKey,
      meta: { tab, nth: desc.nth },
    }).select().single()
    if (data) setAnnotations(prev => [data as UserAnnotation, ...prev])
    window.getSelection()?.removeAllRanges()
    setPopover(null)
  }

  async function removeHighlight(id: string) {
    const supabase = createClient()
    await supabase.from('user_annotations').delete().eq('id', id)
    setAnnotations(prev => prev.filter(a => a.id !== id))
    setPopover(null)
  }

  async function recolorHighlight(id: string, colorKey: string) {
    setAnnotations(prev => prev.map(a => (a.id === id ? { ...a, color: colorKey } : a)))
    setPopover(null)
    const supabase = createClient()
    await supabase.from('user_annotations').update({ color: colorKey }).eq('id', id)
  }

  const notes = annotations.filter(a => a.annotation_type === 'note')

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <Link href="/topics" className="p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors text-gray-500">
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1 className="text-base font-medium text-gray-900 dark:text-gray-100 leading-snug">{topic.name}</h1>
            <div className="flex items-center gap-2 mt-1">
              <PaperBadge paper={topic.paper} section={topic.section} />
              <span className="text-xs text-gray-400">
                {topic.last_studied ? `Studied ${relativeDate(topic.last_studied)}` : 'Never studied'}
              </span>
            </div>
          </div>
        </div>
        <StatusToggle value={status} onChange={handleStatusChange} size="sm" />
      </div>

      {/* Continue where you left off */}
      {showResume && (
        <button
          onClick={continueReading}
          className="w-full mb-4 flex items-center justify-between gap-3 px-4 py-3 bg-brand-50 dark:bg-brand-900/20 border border-brand-200 dark:border-brand-800 rounded-xl text-left hover:bg-brand-100 dark:hover:bg-brand-900/30 transition-colors active:scale-[0.99] group"
        >
          <div className="flex items-center gap-2.5">
            <BookOpenText size={18} className="text-brand-600 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-brand-800 dark:text-brand-200">Continue where you left off</p>
              <p className="text-xs text-brand-600/80 dark:text-brand-300/80">Jump back to your last spot in this topic</p>
            </div>
          </div>
          <span
            role="button"
            tabIndex={-1}
            onClick={(e) => { e.stopPropagation(); setShowResume(false) }}
            className="p-1 rounded-md text-brand-500/70 hover:text-brand-700 hover:bg-brand-200/50 dark:hover:bg-brand-800/50 transition-colors"
            aria-label="Dismiss"
          >
            <X size={15} />
          </span>
        </button>
      )}

      {/* Tabs */}
      <div className="flex border-b border-gray-200 dark:border-[#30363D] mb-5 overflow-x-auto scrollbar-none">
        {tabs.map(t => {
          const isLoadingTab = extracting && (t.key === 'keypoints' || t.key === 'tips')
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                'flex-shrink-0 px-4 py-2.5 text-sm font-medium transition-all duration-150 border-b-2 -mb-px flex items-center gap-1.5',
                tab === t.key
                  ? 'text-brand-600 border-brand-600'
                  : 'text-gray-400 border-transparent hover:text-gray-600 dark:hover:text-gray-300'
              )}
            >
              {t.label}
              {t.key === 'your_source' && userSource && (
                <span className="w-1.5 h-1.5 rounded-full bg-violet-400" title="You added your own source" />
              )}
              {isLoadingTab && (
                <span className="w-3 h-3 border border-gray-300 border-t-brand-400 rounded-full animate-spin" />
              )}
            </button>
          )
        })}
      </div>

      {/* Tab content */}
      <div ref={readerRef} onMouseUp={onReaderMouseUp}>
        {/* Official source */}
        {tab === 'source' && note?.official_source && (
          <div>
            <div className="mb-4 flex items-center gap-2 px-3 py-2 bg-brand-50 dark:bg-brand-900/20 border border-brand-200 dark:border-brand-800 rounded-lg">
              <span className="text-[11px] font-semibold text-white bg-brand-600 px-1.5 py-0.5 rounded-full">Official</span>
              <span className="text-xs text-brand-700 dark:text-brand-300">This is the original source material for this topic</span>
            </div>
            <Markdown>{note.official_source}</Markdown>
            <SourceMeta note={note} />
          </div>
        )}

        {/* Your source — user-uploaded / pasted */}
        {tab === 'your_source' && (
          <div>
            {!editingSource && userSource ? (
              <div>
                <div className="mb-4 flex items-center justify-between gap-2 px-3 py-2 bg-gray-50 dark:bg-[#1C2128] border border-gray-200 dark:border-[#30363D] rounded-lg">
                  <span className="text-xs text-gray-500 dark:text-gray-400">Your own source material — used to ground AI notes and MCQs.</span>
                  <button
                    onClick={() => { setSourceDraft(userSource ?? ''); setEditingSource(true) }}
                    className="flex-shrink-0 flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-800 transition-colors"
                  >
                    <Pencil size={13} /> Edit
                  </button>
                </div>
                <SimplifiableContent content={userSource} topicName={topic.name} preserveBreaks />
              </div>
            ) : !editingSource ? (
              <div className="py-16 text-center">
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Add your own source material for this topic</p>
                <button
                  onClick={() => { setSourceDraft(''); setEditingSource(true) }}
                  className="px-5 py-2.5 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-800 transition-colors active:scale-[0.98]"
                >
                  Add source
                </button>
              </div>
            ) : (
              <div className="border border-gray-200 dark:border-[#30363D] dark:bg-[#161B22] rounded-xl p-4">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,.pdf,.md,.markdown,.txt,text/markdown,text/plain"
                  onChange={handleSourceFile}
                  className="hidden"
                />
                <div className="flex items-center justify-between gap-2 mb-3">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingSource}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-brand-600 border border-brand-200 dark:border-brand-800 rounded-lg hover:bg-brand-50 dark:hover:bg-brand-900/20 transition-colors disabled:opacity-50"
                  >
                    {uploadingSource ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
                    {uploadingSource ? 'Reading…' : 'Upload MD / PDF / image'}
                  </button>
                  <span className="text-xs text-gray-400">or paste below</span>
                </div>
                <textarea
                  value={sourceDraft}
                  onChange={e => setSourceDraft(e.target.value)}
                  rows={14}
                  placeholder="Paste your source material here, or upload a PDF/image to extract its text…"
                  className="w-full text-sm font-mono text-gray-700 dark:text-gray-100 dark:bg-transparent border border-gray-200 dark:border-[#30363D] rounded-lg p-3 resize-y focus:outline-none focus:ring-2 focus:ring-brand-400/30 focus:border-brand-400"
                />
                <div className="flex justify-end gap-2 mt-3">
                  <button
                    onClick={() => { setEditingSource(false); setSourceDraft(userSource ?? '') }}
                    className="text-xs text-gray-400 px-3 py-1.5 hover:text-gray-600"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={saveSource}
                    disabled={savingSource || uploadingSource}
                    className="flex items-center gap-1.5 text-xs font-medium text-white bg-brand-600 px-3 py-1.5 rounded-lg hover:bg-brand-800 transition-colors disabled:opacity-50"
                  >
                    {savingSource && <Loader2 size={13} className="animate-spin" />} Save
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Study note */}
        {tab === 'note' && (
          <div>
            {!note?.study_note && !generating && (
              <div className="py-16 text-center">
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">No study note generated yet</p>
                <button
                  onClick={generateNote}
                  className="px-5 py-2.5 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-800 transition-colors active:scale-[0.98]"
                >
                  Generate study note
                </button>
              </div>
            )}

            {generating && (
              <div>
                {streamText ? (
                  <LoadingStream text={streamText} streaming className="mb-4" />
                ) : (
                  <StreamingSkeleton />
                )}
              </div>
            )}

            {!generating && note?.study_note && (
              <Markdown>{note.study_note}</Markdown>
            )}

            {/* User annotations */}
            {notes.length > 0 && (
              <div className="mt-6 pt-4 border-t border-gray-100">
                <p className="text-xs font-medium text-gray-500 mb-2">Your notes ({notes.length})</p>
                <div className="space-y-2">
                  {notes.map(a => (
                    <div key={a.id} className="bg-gray-50 dark:bg-[#1C2128] rounded-lg px-3 py-2.5">
                      <p className="text-sm text-gray-700">{a.content}</p>
                      <p className="text-xs text-gray-400 mt-1">{relativeDate(a.created_at)}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Add annotation */}
            {showAnnotation && (
              <div className="mt-4 border border-gray-200 dark:border-[#30363D] dark:bg-[#161B22] rounded-xl p-4">
                <textarea
                  value={annotationText}
                  onChange={e => setAnnotationText(e.target.value)}
                  rows={3}
                  placeholder="Add your note…"
                  className="w-full text-sm text-gray-700 dark:text-gray-100 dark:bg-transparent resize-none focus:outline-none"
                  autoFocus
                />
                <div className="flex justify-end gap-2 mt-2">
                  <button onClick={() => setShowAnnotation(false)} className="text-xs text-gray-400 px-3 py-1.5 hover:text-gray-600">Cancel</button>
                  <button onClick={addAnnotation} className="text-xs font-medium text-white bg-brand-600 px-3 py-1.5 rounded-lg hover:bg-brand-800 transition-colors">Save</button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Key points */}
        {tab === 'keypoints' && (
          <div>
            {extracting ? (
              <div className="py-12 text-center">
                <div className="w-5 h-5 border-2 border-gray-200 border-t-brand-600 rounded-full animate-spin mx-auto mb-3" />
                <p className="text-sm text-gray-400">Extracting key points…</p>
              </div>
            ) : note?.key_points ? (
              <Markdown>{note.key_points}</Markdown>
            ) : (
              <div className="py-12 text-center">
                <p className="text-sm text-gray-400 mb-1">No key points yet</p>
                <p className="text-xs text-gray-400">Generate the study note to populate this tab automatically</p>
              </div>
            )}
          </div>
        )}

        {/* Exam tips */}
        {tab === 'tips' && (
          <div>
            {extracting ? (
              <div className="py-12 text-center">
                <div className="w-5 h-5 border-2 border-gray-200 border-t-brand-600 rounded-full animate-spin mx-auto mb-3" />
                <p className="text-sm text-gray-400">Extracting exam tips…</p>
              </div>
            ) : note?.exam_tips ? (
              <Markdown>{note.exam_tips}</Markdown>
            ) : (
              <div className="py-12 text-center">
                <p className="text-sm text-gray-400 mb-1">No exam tips yet</p>
                <p className="text-xs text-gray-400">Generate the study note to populate this tab automatically</p>
              </div>
            )}
          </div>
        )}

        {/* Active recall */}
        {tab === 'recall' && <RecallTab topic={topic} keyPoints={note?.key_points ?? null} />}

        {/* Feynman explain-back */}
        {tab === 'explain' && <ExplainTab topic={topic} keyPoints={note?.key_points ?? null} />}

        {/* Recall by doing (muscle memory) */}
        {tab === 'drill' && <DrillItTab topic={topic} note={note} />}

      </div>

      {/* Floating action bar */}
      {(tab === 'note' || tab === 'source' || tab === 'your_source') && (
        <div className="fixed bottom-16 md:bottom-4 left-0 right-0 md:left-60 flex justify-center px-4 pointer-events-none z-30">
          <div className="bg-white dark:bg-[#161B22] border border-gray-200 dark:border-[#30363D] rounded-xl px-3 py-2 flex items-center gap-2 shadow-sm pointer-events-auto">
            <button
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-brand-600 hover:bg-brand-50 rounded-lg transition-colors"
              onClick={() => openChat(topic.id, topic.name)}
            >
              <MessageSquare size={14} />Ask AI
            </button>
            <div className="w-px h-4 bg-gray-200 dark:bg-[#30363D]" />
            <button
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-50 rounded-lg transition-colors"
              onClick={() => setShowAnnotation(true)}
            >
              <Plus size={14} />Add note
            </button>
            <div className="w-px h-4 bg-gray-200 dark:bg-[#30363D]" />
            <button
              onClick={() => handleStatusChange('done')}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-brand-600 hover:bg-brand-800 rounded-lg transition-colors"
            >
              Mark done
            </button>
          </div>
        </div>
      )}

      {/* Highlight popover — anchored above the selection or the clicked highlight */}
      {popover && (
        <div
          data-hl-popover
          style={{ left: popover.x, top: popover.y }}
          className="fixed z-50 -translate-x-1/2 -translate-y-[calc(100%+8px)] bg-white dark:bg-[#161B22] border border-gray-200 dark:border-[#30363D] rounded-lg shadow-lg px-2 py-1.5 flex items-center gap-1.5"
        >
          {popover.kind === 'create' ? (
            HIGHLIGHT_COLORS.map(c => (
              <button
                key={c.key}
                onClick={() => addHighlight(c.key)}
                title={`Highlight ${c.label.toLowerCase()}`}
                aria-label={`Highlight ${c.label.toLowerCase()}`}
                className="w-5 h-5 rounded-full border border-black/10 dark:border-white/20 hover:scale-110 transition-transform"
                style={{ backgroundColor: c.bg }}
              />
            ))
          ) : (
            <>
              {HIGHLIGHT_COLORS.map(c => (
                <button
                  key={c.key}
                  onClick={() => popover.hlId && recolorHighlight(popover.hlId, c.key)}
                  title={`Change to ${c.label.toLowerCase()}`}
                  aria-label={`Change to ${c.label.toLowerCase()}`}
                  className="w-5 h-5 rounded-full border border-black/10 dark:border-white/20 hover:scale-110 transition-transform"
                  style={{ backgroundColor: c.bg }}
                />
              ))}
              <div className="w-px h-4 bg-gray-200 dark:bg-[#30363D] mx-0.5" />
              <button
                onClick={() => popover.hlId && removeHighlight(popover.hlId)}
                title="Remove highlight"
                aria-label="Remove highlight"
                className="w-6 h-6 flex items-center justify-center rounded-md text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
              >
                <Trash2 size={14} />
              </button>
            </>
          )}
        </div>
      )}

      <ScrollToTop />
    </div>
  )
}
