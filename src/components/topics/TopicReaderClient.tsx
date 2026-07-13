'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { ArrowLeft, MessageSquare, Plus, Upload, Loader2, Pencil, BookOpenText, Trash2, X, ListTree } from 'lucide-react'
import { useChatActions } from '@/components/ai/ChatProvider'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { StatusToggle } from '@/components/shared/StatusToggle'
import { PaperBadge } from '@/components/shared/PaperBadge'
import { LoadingStream, StreamingSkeleton } from '@/components/shared/LoadingStream'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { cn, relativeDate } from '@/lib/utils'
import { GROQ_MODEL_SMART } from '@/lib/constants'
import { Markdown } from '@/components/ui/Markdown'
import { readMarkdownFile } from '@/lib/markdown-file'
import { isSourceLanguage, SOURCE_LANGUAGES, SOURCE_LANGUAGE_STORAGE_KEY, sourceLanguageLabel, type SourceLanguage } from '@/lib/language'
import { readStream } from '@/lib/sse'
import { notifyTokens } from '@/lib/notify-tokens'
import { queueRagIngestion } from '@/lib/rag-client'
import { SimplifiableContent } from '@/components/shared/SimplifiableContent'
import { ScrollToTop } from '@/components/shared/ScrollToTop'
import { SourceMeta } from '@/components/shared/SourceMeta'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { HIGHLIGHT_COLORS, HL_MARK_SELECTOR, applyHighlights, clearHighlights, describeSelection, type StoredHighlight } from '@/lib/highlight'
import type { Topic, TopicNote, UserAnnotation, TopicStatus, ReadingPosition } from '@/types/database'

type Tab = 'source' | 'your_source' | 'note' | 'keypoints' | 'tips' | 'recall' | 'explain' | 'drill'
type LanguageContent = Partial<Record<SourceLanguage, { content: string; file_name: string | null }>>

/** Tabs whose content is plain reading text and therefore highlightable. */
const READING_TABS = new Set<Tab>(['source', 'your_source', 'note', 'keypoints', 'tips'])

interface TocItem {
  id: string
  level: number
  title: string
}

function slugifyHeading(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'section'
}

/** Floating action popover anchored to a text selection or an existing highlight. */
interface Popover { x: number; y: number; kind: 'create' | 'edit'; hlId?: string }

interface Props {
  topic: Topic
  note: TopicNote | null
  annotations: UserAnnotation[]
  resume: ReadingPosition | null
  userId: string | null
}

const RecallTab = dynamic(() => import('@/components/topics/RecallTab').then(mod => mod.RecallTab))
const ExplainTab = dynamic(() => import('@/components/topics/ExplainTab').then(mod => mod.ExplainTab))
const DrillItTab = dynamic(() => import('@/components/topics/DrillItTab').then(mod => mod.DrillItTab))

export function TopicReaderClient({ topic, note: initialNote, annotations: initialAnnotations, resume, userId }: Props) {
  const [tab, setTab] = useState<Tab>(initialNote?.official_source ? 'source' : 'note')
  const [note, setNote] = useState<TopicNote | null>(initialNote)
  const [annotations, setAnnotations] = useState(initialAnnotations)
  const [status, setStatus] = useState<TopicStatus>(topic.status)
  const { openChat } = useChatActions()
  const [generating, setGenerating] = useState(false)
  const [extracting, setExtracting] = useState(false)
  const [streamText, setStreamText] = useState('')
  const [annotationText, setAnnotationText] = useState('')
  const [showAnnotation, setShowAnnotation] = useState(false)
  const [tocOpen, setTocOpen] = useState(false)
  const [tocItems, setTocItems] = useState<TocItem[]>([])
  const [sourceLanguage, setSourceLanguageState] = useState<SourceLanguage>(() => {
    if (typeof window === 'undefined') return 'en'
    try {
      const stored = localStorage.getItem(SOURCE_LANGUAGE_STORAGE_KEY)
      return isSourceLanguage(stored) ? stored : 'en'
    } catch {
      return 'en'
    }
  })
  const readerRef = useRef<HTMLDivElement>(null)

  // Highlighting + resume-reading
  const [popover, setPopover] = useState<Popover | null>(null)
  const canResume = !!resume && READING_TABS.has((resume.last_read_tab ?? '') as Tab) && (resume.last_read_scroll ?? 0) > 0.05
  const [showResume, setShowResume] = useState(canResume)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Language-specific sources.
  const [officialSources, setOfficialSources] = useState<LanguageContent>({})
  const [userSources, setUserSources] = useState<LanguageContent>({})
  const [editingSource, setEditingSource] = useState(false)
  const [sourceDraft, setSourceDraft] = useState('')
  const [sourceDraftFileName, setSourceDraftFileName] = useState<string | null>(null)
  const [uploadingSource, setUploadingSource] = useState(false)
  const [savingSource, setSavingSource] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [userKeyPoints, setUserKeyPoints] = useState<{ content: string; file_name: string | null } | null>(null)
  const [editingKeyPoints, setEditingKeyPoints] = useState(false)
  const [keyPointsDraft, setKeyPointsDraft] = useState('')
  const [keyPointsDraftFileName, setKeyPointsDraftFileName] = useState<string | null>(null)
  const [uploadingKeyPoints, setUploadingKeyPoints] = useState(false)
  const [savingKeyPoints, setSavingKeyPoints] = useState(false)
  const keyPointsFileInputRef = useRef<HTMLInputElement>(null)

  function setSourceLanguage(language: SourceLanguage) {
    setSourceLanguageState(language)
    try { localStorage.setItem(SOURCE_LANGUAGE_STORAGE_KEY, language) } catch {}
    if (editingSource) {
      setSourceDraft(userSources[language]?.content ?? '')
      setSourceDraftFileName(userSources[language]?.file_name ?? null)
    }
  }

  // Load language-specific official and user sources for this topic.
  useEffect(() => {
    let active = true
    const supabase = createClient()
    Promise.all([
      supabase.from('topic_source_files').select('language,content,file_name').eq('topic_id', topic.id),
      supabase.from('user_topic_source_files').select('language,content,file_name').eq('topic_id', topic.id),
      supabase.from('user_topic_key_notes').select('content,file_name').eq('topic_id', topic.id).maybeSingle(),
    ]).then(([official, user, keyPoints]) => {
        if (!active) return
        const nextOfficial: LanguageContent = {}
        for (const row of official.data ?? []) {
          if (isSourceLanguage(row.language)) nextOfficial[row.language] = { content: row.content, file_name: row.file_name ?? null }
        }
        const nextUser: LanguageContent = {}
        for (const row of user.data ?? []) {
          if (isSourceLanguage(row.language)) nextUser[row.language] = { content: row.content, file_name: row.file_name ?? null }
        }
        setOfficialSources(nextOfficial)
        setUserSources(nextUser)
        setUserKeyPoints(keyPoints.data?.content ? { content: keyPoints.data.content, file_name: keyPoints.data.file_name ?? null } : null)
        if (!initialNote?.official_source && Object.keys(nextOfficial).length > 0) setTab('source')
      })
    return () => { active = false }
  }, [topic.id, initialNote?.official_source])

  const tabs: { key: Tab; label: string }[] = [
    { key: 'source' as Tab, label: 'Official source' },
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
      const text = await readMarkdownFile(file)
      setSourceDraft(prev => (prev.trim() ? `${prev.trim()}\n\n${text.trim()}` : text.trim()))
      setSourceDraftFileName(file.name)
      toast.success('Markdown loaded — review and save')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not read file')
    } finally {
      setUploadingSource(false)
    }
  }

  async function saveSource() {
    setSavingSource(true)
    const value = sourceDraft.trim()
    if (!value) {
      setSavingSource(false)
      toast.error('Source cannot be empty')
      return
    }
    const supabase = createClient()
    if (!userId) {
      setSavingSource(false)
      toast.error('Please sign in to save source')
      return
    }
    const { error } = await supabase.from('user_topic_source_files').upsert({
      user_id: userId,
      topic_id: topic.id,
      language: sourceLanguage,
      content: value,
      file_name: sourceDraftFileName,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,topic_id,language' })
    setSavingSource(false)
    if (error) { toast.error('Failed to save source'); return }
    setUserSources(prev => ({ ...prev, [sourceLanguage]: { content: value, file_name: sourceDraftFileName ?? prev[sourceLanguage]?.file_name ?? null } }))
    setEditingSource(false)
    toast.success('Source saved')
    queueRagIngestion(topic.id)
  }

  async function handleKeyPointsFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (e.target) e.target.value = ''
    if (!file) return
    setUploadingKeyPoints(true)
    try {
      const text = await readMarkdownFile(file)
      setKeyPointsDraft(text.trim())
      setKeyPointsDraftFileName(file.name)
      toast.success('Markdown loaded — review and save')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not read file')
    } finally {
      setUploadingKeyPoints(false)
    }
  }

  async function saveKeyPoints() {
    setSavingKeyPoints(true)
    const value = keyPointsDraft.trim()
    if (!value) {
      setSavingKeyPoints(false)
      toast.error('Key points cannot be empty')
      return
    }
    const supabase = createClient()
    if (!userId) {
      setSavingKeyPoints(false)
      toast.error('Please sign in to save key points')
      return
    }
    const { error } = await supabase.from('user_topic_key_notes').upsert({
      user_id: userId,
      topic_id: topic.id,
      content: value,
      file_name: keyPointsDraftFileName,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,topic_id' })
    setSavingKeyPoints(false)
    if (error) { toast.error('Failed to save key points'); return }
    setUserKeyPoints({ content: value, file_name: keyPointsDraftFileName })
    setEditingKeyPoints(false)
    toast.success('Key points saved')
    queueRagIngestion(topic.id)
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
        model_used: GROQ_MODEL_SMART,
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
  const selectedOfficialSource = officialSources[sourceLanguage]?.content ?? (sourceLanguage === 'en' ? note?.official_source ?? null : null)
  const selectedUserSource = userSources[sourceLanguage]?.content ?? null
  const selectedUserSourceFileName = userSources[sourceLanguage]?.file_name ?? null
  const effectiveKeyPoints = userKeyPoints?.content ?? note?.key_points ?? null
  const headingIdPrefix = `topic-${topic.id}-${tab}`

  const refreshTocItems = useCallback(() => {
    const root = readerRef.current
    if (!root) {
      setTocItems([])
      return
    }
    const counts = new Map<string, number>()
    const headings = Array.from(root.querySelectorAll<HTMLHeadingElement>('h1, h2, h3'))
      .map((heading) => {
        const title = heading.textContent?.trim() ?? ''
        if (!title) return null
        if (!heading.id) {
          const base = slugifyHeading(title)
          const count = counts.get(base) ?? 0
          counts.set(base, count + 1)
          heading.id = `${headingIdPrefix}-${base}${count ? `-${count + 1}` : ''}`
        }
        return {
          id: heading.id,
          level: Number(heading.tagName.slice(1)),
          title,
        }
      })
      .filter((item): item is TocItem => Boolean(item))
    setTocItems(headings)
  }, [headingIdPrefix])

  useEffect(() => {
    const frame = requestAnimationFrame(refreshTocItems)
    return () => cancelAnimationFrame(frame)
  }, [tab, note, officialSources, userSources, userKeyPoints, sourceLanguage, generating, extracting, streamText, refreshTocItems])

  function jumpToTocItem(id: string) {
    setTocOpen(false)
    setTimeout(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 80)
  }

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
              {t.key === 'your_source' && selectedUserSource && (
                <span className="w-1.5 h-1.5 rounded-full bg-violet-400" title="You added your own source" />
              )}
              {isLoadingTab && (
                <span className="w-3 h-3 border border-gray-300 border-t-brand-400 rounded-full animate-spin" />
              )}
            </button>
          )
        })}
      </div>

      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex w-full bg-gray-100 dark:bg-[#1C2128] rounded-lg p-0.5 sm:w-auto" aria-label="Source language">
          {SOURCE_LANGUAGES.map(language => (
            <button
              key={language.key}
              onClick={() => setSourceLanguage(language.key)}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-brand-400/40',
                sourceLanguage === language.key
                  ? 'bg-white text-gray-900 shadow-sm dark:bg-[#161B22] dark:text-gray-100'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-600 dark:hover:text-gray-300',
              )}
            >
              {language.label}
            </button>
          ))}
        </div>
        <button
            onClick={() => {
              refreshTocItems()
              setTocOpen(true)
            }}
          className="flex min-h-10 w-full items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm transition-all duration-150 hover:border-brand-300 hover:text-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-400/40 dark:border-[#30363D] dark:bg-[#161B22] dark:text-gray-200 dark:hover:border-brand-800 dark:hover:text-brand-200 sm:w-auto"
          aria-label="Open table of contents"
        >
          <ListTree size={16} />
          Contents
        </button>
      </div>

      <Dialog open={tocOpen} onOpenChange={setTocOpen}>
        <DialogContent className="max-h-[min(80dvh,36rem)] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Contents</DialogTitle>
            <DialogDescription>Jump to a section in the selected tab.</DialogDescription>
          </DialogHeader>
          <div className="-mx-1 max-h-[calc(min(80dvh,36rem)-7rem)] overflow-y-auto pr-1">
            <p className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400">Sections in {tabs.find(item => item.key === tab)?.label ?? 'current tab'}</p>
            {tocItems.length > 0 ? (
              <div className="space-y-1">
                {tocItems.map(item => (
                  <button
                    key={item.id}
                    onClick={() => jumpToTocItem(item.id)}
                    className={cn(
                      'flex min-h-11 w-full items-center rounded-lg px-3 py-2 text-left text-sm text-gray-700 transition-colors hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-400/40 dark:text-gray-200 dark:hover:bg-[#1C2128]',
                      item.level === 2 && 'pl-6',
                      item.level === 3 && 'pl-9 text-gray-500 dark:text-gray-400',
                    )}
                  >
                    <span className="line-clamp-2">{item.title}</span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">No headings found in this tab yet.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Tab content */}
      <div ref={readerRef} onMouseUp={onReaderMouseUp}>
        {/* Official source */}
        {tab === 'source' && (
          <div>
            <div className="mb-4 flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 dark:border-[#30363D] dark:bg-[#1C2128]">
              <span className="rounded-full bg-brand-600 px-1.5 py-0.5 text-[11px] font-semibold text-white">Official</span>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {sourceLanguageLabel(sourceLanguage)} official source material for this topic
              </span>
            </div>
            {selectedOfficialSource ? (
              <>
                <SimplifiableContent content={selectedOfficialSource} topicName={topic.name} preserveBreaks headingIdPrefix={headingIdPrefix} />
                {note && sourceLanguage === 'en' && !officialSources.en && <SourceMeta note={note} />}
              </>
            ) : (
              <div className="py-12 text-center">
                <p className="text-sm text-gray-400 mb-1">No {sourceLanguageLabel(sourceLanguage).toLowerCase()} official source yet</p>
                <p className="text-xs text-gray-400">Ask an admin to upload a Markdown source for this language.</p>
              </div>
            )}
          </div>
        )}

        {/* Your source — user-uploaded / pasted */}
        {tab === 'your_source' && (
          <div>
            {!editingSource && selectedUserSource ? (
              <div>
                <div className="mb-4 flex flex-col gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 dark:border-[#30363D] dark:bg-[#1C2128] sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    Your {sourceLanguageLabel(sourceLanguage).toLowerCase()} source material
                    {selectedUserSourceFileName ? <span className="ml-1 text-gray-400">· {selectedUserSourceFileName}</span> : null}
                  </span>
                  <button
                    onClick={() => { setSourceDraft(selectedUserSource ?? ''); setSourceDraftFileName(selectedUserSourceFileName); setEditingSource(true) }}
                    className="flex min-h-9 flex-shrink-0 items-center gap-1 self-start rounded-md px-2 text-xs font-medium text-brand-600 transition-colors hover:bg-brand-50 hover:text-brand-800 dark:hover:bg-brand-900/20 sm:self-auto"
                  >
                    <Pencil size={13} /> Edit
                  </button>
                </div>
                <SimplifiableContent content={selectedUserSource} topicName={topic.name} preserveBreaks headingIdPrefix={headingIdPrefix} />
              </div>
            ) : !editingSource ? (
              <div className="py-16 text-center">
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Add your own {sourceLanguageLabel(sourceLanguage).toLowerCase()} source material for this topic</p>
                <button
                  onClick={() => { setSourceDraft(''); setSourceDraftFileName(null); setEditingSource(true) }}
                  className="min-h-10 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white transition-all duration-150 hover:bg-brand-800 active:scale-[0.98]"
                >
                  Upload Markdown
                </button>
              </div>
            ) : (
              <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-[#30363D] dark:bg-[#161B22]">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".md,.markdown,text/markdown"
                  onChange={handleSourceFile}
                  className="hidden"
                />
                <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingSource}
                    className="flex min-h-9 items-center justify-center gap-1.5 rounded-lg border border-brand-200 px-3 py-1.5 text-xs font-medium text-brand-600 transition-colors hover:bg-brand-50 disabled:opacity-50 dark:border-brand-800 dark:hover:bg-brand-900/20 sm:justify-start"
                  >
                    {uploadingSource ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
                    {uploadingSource ? 'Reading…' : 'Upload MD'}
                  </button>
                  <span className="text-xs text-gray-400">{sourceLanguageLabel(sourceLanguage)} source</span>
                </div>
                <textarea
                  value={sourceDraft}
                  onChange={e => setSourceDraft(e.target.value)}
                  rows={14}
                  placeholder={`Paste your ${sourceLanguageLabel(sourceLanguage).toLowerCase()} source Markdown here, or upload a .md file…`}
                  className="w-full text-sm font-mono text-gray-700 dark:text-gray-100 dark:bg-transparent border border-gray-200 dark:border-[#30363D] rounded-lg p-3 resize-y focus:outline-none focus:ring-2 focus:ring-brand-400/30 focus:border-brand-400"
                />
                <div className="mt-3 flex justify-end gap-2">
                  <button
                    onClick={() => { setEditingSource(false); setSourceDraft(selectedUserSource ?? ''); setSourceDraftFileName(selectedUserSourceFileName) }}
                    className="min-h-9 rounded-md px-3 py-1.5 text-xs text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-[#1C2128]"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={saveSource}
                    disabled={savingSource || uploadingSource}
                    className="flex min-h-9 items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-brand-800 disabled:opacity-50"
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
              <Markdown headingIdPrefix={headingIdPrefix}>{note.study_note}</Markdown>
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
            ) : editingKeyPoints ? (
              <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-[#30363D] dark:bg-[#161B22]">
                <input ref={keyPointsFileInputRef} type="file" accept=".md,.markdown,text/markdown" onChange={handleKeyPointsFile} className="hidden" />
                <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <button
                    onClick={() => keyPointsFileInputRef.current?.click()}
                    disabled={uploadingKeyPoints}
                    className="flex min-h-9 items-center justify-center gap-1.5 rounded-lg border border-brand-200 px-3 py-1.5 text-xs font-medium text-brand-600 transition-colors hover:bg-brand-50 disabled:opacity-50 dark:border-brand-800 dark:hover:bg-brand-900/20 sm:justify-start"
                  >
                    {uploadingKeyPoints ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
                    {uploadingKeyPoints ? 'Reading…' : 'Upload MD'}
                  </button>
                  <span className="text-xs text-gray-400">{keyPointsDraftFileName ?? userKeyPoints?.file_name ?? 'Markdown key points'}</span>
                </div>
                <textarea
                  value={keyPointsDraft}
                  onChange={e => { setKeyPointsDraft(e.target.value); setKeyPointsDraftFileName(null) }}
                  rows={12}
                  placeholder="Paste key points Markdown here, or upload a .md file..."
                  className="w-full resize-y rounded-lg border border-gray-200 p-3 font-mono text-sm text-gray-700 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-400/30 dark:border-[#30363D] dark:bg-transparent dark:text-gray-100"
                />
                <div className="mt-3 flex justify-end gap-2">
                  <button
                    onClick={() => { setEditingKeyPoints(false); setKeyPointsDraft(userKeyPoints?.content ?? '') }}
                    className="min-h-9 rounded-md px-3 py-1.5 text-xs text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-[#1C2128]"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={saveKeyPoints}
                    disabled={savingKeyPoints || uploadingKeyPoints}
                    className="flex min-h-9 items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-brand-800 disabled:opacity-50"
                  >
                    {savingKeyPoints && <Loader2 size={13} className="animate-spin" />} Save
                  </button>
                </div>
              </div>
            ) : effectiveKeyPoints ? (
              <div>
                <div className="mb-4 flex flex-col gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 dark:border-[#30363D] dark:bg-[#1C2128] sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {userKeyPoints ? 'Your uploaded key points' : 'AI extracted key points'}
                    {userKeyPoints?.file_name ? <span className="ml-1 text-gray-400">· {userKeyPoints.file_name}</span> : null}
                  </span>
                  <button
                    onClick={() => { setKeyPointsDraft(userKeyPoints?.content ?? note?.key_points ?? ''); setKeyPointsDraftFileName(userKeyPoints?.file_name ?? null); setEditingKeyPoints(true) }}
                    className="flex min-h-9 flex-shrink-0 items-center gap-1 self-start rounded-md px-2 text-xs font-medium text-brand-600 transition-colors hover:bg-brand-50 hover:text-brand-800 dark:hover:bg-brand-900/20 sm:self-auto"
                  >
                    {userKeyPoints ? <><Pencil size={13} /> Edit</> : <><Upload size={13} /> Upload MD</>}
                  </button>
                </div>
                <Markdown headingIdPrefix={headingIdPrefix}>{effectiveKeyPoints}</Markdown>
              </div>
            ) : (
              <div className="py-12 text-center">
                <p className="text-sm text-gray-400 mb-1">No key points yet</p>
                <p className="text-xs text-gray-400 mb-4">Generate the study note or upload Markdown key points.</p>
                <button
                  onClick={() => { setKeyPointsDraft(''); setKeyPointsDraftFileName(null); setEditingKeyPoints(true) }}
                  className="min-h-10 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white transition-all duration-150 hover:bg-brand-800 active:scale-[0.98]"
                >
                  Upload Markdown
                </button>
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
              <Markdown headingIdPrefix={headingIdPrefix}>{note.exam_tips}</Markdown>
            ) : (
              <div className="py-12 text-center">
                <p className="text-sm text-gray-400 mb-1">No exam tips yet</p>
                <p className="text-xs text-gray-400">Generate the study note to populate this tab automatically</p>
              </div>
            )}
          </div>
        )}

        {/* Active recall */}
        {tab === 'recall' && <RecallTab topic={topic} keyPoints={effectiveKeyPoints} />}

        {/* Feynman explain-back */}
        {tab === 'explain' && <ExplainTab topic={topic} keyPoints={effectiveKeyPoints} />}

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
