'use client'

import { useState, useEffect, useCallback, useRef, type ReactNode } from 'react'
import { BookOpen, PenLine, MessageSquare, Plus, ChevronRight, ChevronDown, Layers, RefreshCw, Upload, Loader2, Pencil, Sparkles, ListTree } from 'lucide-react'
import { toast } from 'sonner'
import { cn, relativeDate } from '@/lib/utils'
import { useChatActions, useChatState } from '@/components/ai/ChatProvider'
import { Markdown } from '@/components/ui/Markdown'
import { SimplifiableContent } from '@/components/shared/SimplifiableContent'
import { ScrollToTop } from '@/components/shared/ScrollToTop'
import { SourceMeta } from '@/components/shared/SourceMeta'
import { LoadingStream, StreamingSkeleton } from '@/components/shared/LoadingStream'
import { StatusToggle } from '@/components/shared/StatusToggle'
import { SubtopicDetail } from '@/components/shared/SubtopicDetail'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { fetchSubtopics } from '@/lib/subtopics'
import { createClient } from '@/lib/supabase/client'
import { readMarkdownFile } from '@/lib/markdown-file'
import { isSourceLanguage, SOURCE_LANGUAGES, SOURCE_LANGUAGE_STORAGE_KEY, sourceLanguageLabel, type SourceLanguage } from '@/lib/language'
import { readStream } from '@/lib/sse'
import { notifyTokens } from '@/lib/notify-tokens'
import { queueRagIngestion } from '@/lib/rag-client'
import { useHighlighter } from '@/hooks/useHighlighter'
import { useResumeReading, type SavedPosition } from '@/hooks/useResumeReading'
import { HighlightPopover } from '@/components/shared/HighlightPopover'
import { KeyboardShortcutsDialog } from '@/components/shared/KeyboardShortcutsDialog'
import { ResumeBanner } from '@/components/shared/ResumeBanner'
import { shortcutLabel, useKeyboardShortcuts, type ShortcutDefinition } from '@/hooks/useKeyboardShortcuts'
import { useStudyActivityTracker } from '@/hooks/useStudyActivityTracker'
import { GROQ_MODEL_SMART } from '@/lib/constants'
import { recordStudyEvent } from '@/lib/study-events'
import type { Topic, TopicNote, TopicStatus, UserAnnotation, Subtopic } from '@/types/database'

type SubTab = 'study' | 'practice'
type StudyTab = 'source' | 'your_source' | 'note' | 'keypoints' | 'tips'
type LanguageContent = Partial<Record<SourceLanguage, { content: string; file_name: string | null }>>

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
  const { openChat, toggleChat, closeChat, dock, undock, setExpanded } = useChatActions()
  const { docked, expanded: chatExpanded } = useChatState()
  const [annotationText, setAnnotationText] = useState('')
  const [showAnnotation, setShowAnnotation] = useState(false)
  const [status, setStatus] = useState<TopicStatus>(topic.status)
  const [subtopics, setSubtopics] = useState<Subtopic[]>([])
  const [selectedSubtopic, setSelectedSubtopic] = useState<Subtopic | null>(null)
  const [subtopicsOpen, setSubtopicsOpen] = useState(true)
  const [tocOpen, setTocOpen] = useState(false)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
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

  // Desktop (xl+) chat rail (ChatDock in Shell). Dock on open, undock on leave;
  // remember the collapsed preference across topics.
  useEffect(() => {
    let open = true
    try { open = localStorage.getItem('chatDock:open') !== '0' } catch { /* ignore */ }
    if (open) dock(topic.id, topic.name)
    return () => { undock() }
  }, [topic.id, topic.name, dock, undock])

  // Persist the user's show/hide choice as they toggle the rail (mount-scoped).
  useEffect(() => {
    try { localStorage.setItem('chatDock:open', docked ? '1' : '0') } catch { /* ignore */ }
  }, [docked])

  // Highlighting + resume-reading
  const readerRef = useRef<HTMLDivElement>(null)
  const [resume, setResume] = useState<SavedPosition | null>(null)
  const readingView = subTab === 'study' || !practiceTab
  useStudyActivityTracker({ topicId: topic.id, tab: studyTab, enabled: readingView && !selectedSubtopic })
  const { popover, onMouseUp, pick, removeHighlight } = useHighlighter({
    readerRef, tab: studyTab, enabled: readingView, topicId: topic.id,
    annotations, setAnnotations, reapplyKey: topicNote,
  })
  const saveProgress = (t: string, scroll: number) => {
    const supabase = createClient()
    void supabase.from('user_topic_progress').upsert(
      { topic_id: topic.id, last_read_tab: t, last_read_scroll: scroll },
      { onConflict: 'user_id,topic_id' },
    )
  }
  const { showResume, dismissResume, continueReading } = useResumeReading({
    enabled: readingView, tab: studyTab, saved: resume,
    save: saveProgress, onResumeTab: (t) => setStudyTab(t as StudyTab),
  })

  // Language-specific sources.
  const [editingSource, setEditingSource] = useState(false)
  const [sourceDraft, setSourceDraft] = useState('')
  const [sourceDraftFileName, setSourceDraftFileName] = useState<string | null>(null)
  const [uploadingSource, setUploadingSource] = useState(false)
  const [savingSource, setSavingSource] = useState(false)
  const [officialSources, setOfficialSources] = useState<LanguageContent>({})
  const [userSources, setUserSources] = useState<LanguageContent>({})
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [userKeyPoints, setUserKeyPoints] = useState<{ content: string; file_name: string | null } | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
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

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const [{ data: { user } }, { data: note }, { data: anns }, subs, { data: progress }, { data: officialRows }, { data: userRows }, { data: keyPoints }] = await Promise.all([
        supabase.auth.getUser(),
        supabase.from('topic_notes').select('*').eq('topic_id', topic.id).maybeSingle(),
        supabase.from('user_annotations').select('*').eq('topic_id', topic.id).order('created_at', { ascending: false }),
        fetchSubtopics(topic.id),
        supabase.from('user_topic_progress').select('last_read_tab,last_read_scroll').eq('topic_id', topic.id).maybeSingle(),
        supabase.from('topic_source_files').select('language,content,file_name').eq('topic_id', topic.id),
        supabase.from('user_topic_source_files').select('language,content,file_name').eq('topic_id', topic.id),
        supabase.from('user_topic_key_notes').select('content,file_name').eq('topic_id', topic.id).maybeSingle(),
      ])
      setTopicNote(note)
      setUserId(user?.id ?? null)
      setAnnotations(anns ?? [])
      setSubtopics(subs)
      setResume(progress ? { tab: progress.last_read_tab, scroll: progress.last_read_scroll } : null)
      const nextOfficial: LanguageContent = {}
      for (const row of officialRows ?? []) {
        if (isSourceLanguage(row.language)) nextOfficial[row.language] = { content: row.content, file_name: row.file_name ?? null }
      }
      const nextUser: LanguageContent = {}
      for (const row of userRows ?? []) {
        if (isSourceLanguage(row.language)) nextUser[row.language] = { content: row.content, file_name: row.file_name ?? null }
      }
      setOfficialSources(nextOfficial)
      setUserSources(nextUser)
      setUserKeyPoints(keyPoints?.content ? { content: keyPoints.content, file_name: keyPoints.file_name ?? null } : null)
      if (note?.official_source || Object.keys(nextOfficial).length > 0) setStudyTab('source')
      else setStudyTab('note')
    }
    load()
  }, [topic.id])

  // Fire-and-forget: keep the RAG index fresh after content changes.
  function reindexTopic() {
    queueRagIngestion(topic.id)
  }

  async function generateNote() {
    setGenerating(true); setStreamText('')
    try {
      const res = await fetch('/api/ai/generate-note', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topicId: topic.id, topicName: topic.name, paper: topic.paper, section: topic.section, subsections: topic.subsections }),
      })
      if (!res.ok) throw new Error('Failed')
      const { text: full, tokens } = await readStream(res, setStreamText)
      notifyTokens(tokens)
      const supabase = createClient()
      await supabase.from('topic_notes').upsert({ topic_id: topic.id, study_note: full, generated_at: new Date().toISOString(), model_used: GROQ_MODEL_SMART, updated_at: new Date().toISOString() })
      void recordStudyEvent({
        topicId: topic.id,
        eventType: 'ai_note',
        source: 'ai',
        metadata: { action: 'generate_note', model: GROQ_MODEL_SMART },
      })
      setTopicNote(prev => ({ ...(prev ?? {} as TopicNote), study_note: full }))
      toast.success('Study note generated — extracting key points…')
      setExtracting(true)
      try {
        const ext = await fetch('/api/ai/extract-note-sections', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ topicId: topic.id, studyNote: full }) })
        if (ext.ok) { const s = await ext.json(); setTopicNote(prev => prev ? { ...prev, key_points: s.key_points, exam_tips: s.exam_tips } : prev); toast.success('Key points and exam tips ready') }
      } catch {} finally { setExtracting(false) }
      reindexTopic()
    } catch { toast.error('Failed to generate note') } finally { setGenerating(false) }
  }

  async function handleStatusChange(s: TopicStatus) {
    setStatus(s); onStatusChange(topic.id, s)
    const supabase = createClient()
    await supabase.from('user_topic_progress').upsert({ topic_id: topic.id, status: s }, { onConflict: 'user_id,topic_id' })
    if (s === 'done') {
      void recordStudyEvent({ topicId: topic.id, eventType: 'mark_done', source: 'manual', metadata: { status: s } })
    }
    toast.success('Status updated')
    fetch('/api/ai/replan-schedule', { method: 'POST' }).catch(() => {})
  }

  async function addAnnotation() {
    if (!annotationText.trim()) return
    const supabase = createClient()
    const { data } = await supabase.from('user_annotations').insert({ topic_id: topic.id, content: annotationText.trim(), annotation_type: 'note' }).select().single()
    if (data) { setAnnotations(prev => [data, ...prev]); setAnnotationText(''); setShowAnnotation(false); toast.success('Note added'); reindexTopic() }
  }

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
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Could not read file') } finally { setUploadingSource(false) }
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
    const { error } = await supabase.from('user_topic_source_files').upsert(
      { user_id: userId, topic_id: topic.id, language: sourceLanguage, content: value, file_name: sourceDraftFileName, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,topic_id,language' },
    )
    setSavingSource(false)
    if (error) { toast.error('Failed to save source'); return }
    setUserSources(prev => ({ ...prev, [sourceLanguage]: { content: value, file_name: sourceDraftFileName ?? prev[sourceLanguage]?.file_name ?? null } }))
    setEditingSource(false)
    toast.success('Source saved')
    reindexTopic()
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
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Could not read file') } finally { setUploadingKeyPoints(false) }
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
    const { error } = await supabase.from('user_topic_key_notes').upsert(
      { user_id: userId, topic_id: topic.id, content: value, file_name: keyPointsDraftFileName, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,topic_id' },
    )
    setSavingKeyPoints(false)
    if (error) { toast.error('Failed to save key points'); return }
    setUserKeyPoints({ content: value, file_name: keyPointsDraftFileName })
    setEditingKeyPoints(false)
    toast.success('Key points saved')
    reindexTopic()
  }

  const notes = annotations.filter(a => a.annotation_type === 'note')
  const selectedOfficialSource = officialSources[sourceLanguage]?.content ?? (sourceLanguage === 'en' ? topicNote?.official_source ?? null : null)
  const selectedUserSource = userSources[sourceLanguage]?.content ?? null
  const selectedUserSourceFileName = userSources[sourceLanguage]?.file_name ?? null
  const effectiveKeyPoints = userKeyPoints?.content ?? topicNote?.key_points ?? null
  const studyTabs: { key: StudyTab; label: string }[] = [
    { key: 'source' as StudyTab, label: 'Official source' },
    { key: 'your_source', label: 'Your source' },
    { key: 'note', label: 'AI note' }, { key: 'keypoints', label: 'Key points' }, { key: 'tips', label: 'Exam tips' },
  ]
  const headingIdPrefix = `topic-detail-${topic.id}-${studyTab}`

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
  }, [studyTab, topicNote, officialSources, userSources, userKeyPoints, sourceLanguage, generating, extracting, streamText, refreshTocItems])

  function jumpToTocItem(id: string) {
    setTocOpen(false)
    setTimeout(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 80)
  }

  function openContents() {
    refreshTocItems()
    setTocOpen(true)
  }

  function moveStudyTab(direction: 1 | -1) {
    const index = studyTabs.findIndex(item => item.key === studyTab)
    const next = studyTabs[(index + direction + studyTabs.length) % studyTabs.length]
    if (next) {
      setSubTab('study')
      setStudyTab(next.key)
    }
  }

  function toggleSourceLanguage() {
    setSourceLanguage(sourceLanguage === 'en' ? 'ne' : 'en')
  }

  function toggleTopicChat() {
    if (typeof window !== 'undefined' && window.innerWidth >= 1280) {
      if (docked) undock()
      else dock(topic.id, topic.name)
      return
    }
    toggleChat(topic.id, topic.name)
  }

  const shortcuts: ShortcutDefinition[] = [
    {
      id: 'chat-toggle',
      label: 'Open or close Ask AI',
      keys: 'mod+k',
      handler: toggleTopicChat,
    },
    {
      id: 'chat-expand',
      label: 'Expand or collapse chat',
      keys: 'mod+shift+k',
      handler: () => setExpanded(!chatExpanded),
    },
    {
      id: 'language-toggle',
      label: 'Toggle English/Nepali',
      keys: 'mod+shift+l',
      handler: toggleSourceLanguage,
      enabled: readingView && !selectedSubtopic,
    },
    {
      id: 'next-tab',
      label: 'Next study tab',
      keys: 'mod+shift+arrowright',
      handler: () => moveStudyTab(1),
      enabled: readingView && !selectedSubtopic,
    },
    {
      id: 'previous-tab',
      label: 'Previous study tab',
      keys: 'mod+shift+arrowleft',
      handler: () => moveStudyTab(-1),
      enabled: readingView && !selectedSubtopic,
    },
    {
      id: 'contents',
      label: 'Open contents',
      keys: 'mod+shift+c',
      handler: openContents,
      enabled: readingView && !selectedSubtopic,
    },
    {
      id: 'mark-done',
      label: 'Mark topic done',
      keys: 'mod+enter',
      handler: () => { void handleStatusChange('done') },
      enabled: !selectedSubtopic,
    },
    {
      id: 'add-note',
      label: 'Add note',
      keys: 'mod+shift+a',
      handler: () => {
        setSubTab('study')
        setShowAnnotation(true)
      },
      enabled: readingView && !selectedSubtopic,
    },
    {
      id: 'help',
      label: 'Show keyboard shortcuts',
      keys: 'mod+/',
      handler: () => setShortcutsOpen(true),
    },
  ]

  useKeyboardShortcuts(shortcuts)

  const topicView = (
    <div>
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <button onClick={() => { onBack(); closeChat() }} className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 mb-2 transition-colors">← Back to topics</button>
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
          {showResume && !selectedSubtopic && <ResumeBanner onContinue={continueReading} onDismiss={dismissResume} />}
          {subtopics.length > 0 && (
            <div className="mb-5">
              <button
                onClick={() => setSubtopicsOpen(o => !o)}
                aria-expanded={subtopicsOpen}
                className="flex items-center gap-1.5 mb-2 w-full text-left group"
              >
                <Layers size={13} className="text-brand-500" />
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Subtopics</p>
                <span className="text-[11px] text-gray-400">· {subtopics.length}</span>
                <ChevronDown size={14} className={cn('text-gray-400 ml-auto transition-transform duration-150 group-hover:text-gray-600 dark:group-hover:text-gray-300', !subtopicsOpen && '-rotate-90')} />
              </button>
              {subtopicsOpen && (
              <>
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
              </>
              )}
            </div>
          )}

          <div className="flex border-b border-gray-200 dark:border-[#30363D] mb-5 overflow-x-auto scrollbar-none">
            {studyTabs.map(t => (
              <button key={t.key} onClick={() => setStudyTab(t.key)} className={cn('flex-shrink-0 px-4 py-2.5 text-sm font-medium transition-all duration-150 border-b-2 -mb-px flex items-center gap-1.5', studyTab === t.key ? 'text-brand-600 border-brand-600' : 'text-gray-400 border-transparent hover:text-gray-600 dark:hover:text-gray-300')}>
                {t.label}
                {t.key === 'your_source' && selectedUserSource && <span className="w-1.5 h-1.5 rounded-full bg-violet-400" title="You added your own source" />}
                {extracting && (t.key === 'keypoints' || t.key === 'tips') && <span className="w-3 h-3 border border-gray-300 border-t-brand-400 rounded-full animate-spin" />}
              </button>
            ))}
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
              onClick={openContents}
              className="flex min-h-10 w-full items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm transition-all duration-150 hover:border-brand-300 hover:text-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-400/40 dark:border-[#30363D] dark:bg-[#161B22] dark:text-gray-200 dark:hover:border-brand-800 dark:hover:text-brand-200 sm:w-auto"
              aria-label={`Open table of contents (${shortcutLabel('mod+shift+c')})`}
              title={`Open contents (${shortcutLabel('mod+shift+c')})`}
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
                <p className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400">Sections in {studyTabs.find(item => item.key === studyTab)?.label ?? 'current tab'}</p>
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

          <div ref={readerRef} onMouseUp={onMouseUp}>
          {studyTab === 'source' && (
            <div>
              <div className="mb-4 flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 dark:border-[#30363D] dark:bg-[#1C2128]">
                <span className="rounded-full bg-brand-600 px-1.5 py-0.5 text-[11px] font-semibold text-white">Official</span>
                <span className="text-xs text-gray-500 dark:text-gray-400">{sourceLanguageLabel(sourceLanguage)} official source material for this topic</span>
              </div>
              {selectedOfficialSource ? (
                <>
                  <SimplifiableContent content={selectedOfficialSource} topicName={topic.name} preserveBreaks headingIdPrefix={headingIdPrefix} />
                  {topicNote && sourceLanguage === 'en' && !officialSources.en && <SourceMeta note={topicNote} />}
                </>
              ) : (
                <div className="py-12 text-center">
                  <p className="text-sm text-gray-400 mb-1">No {sourceLanguageLabel(sourceLanguage).toLowerCase()} official source yet</p>
                  <p className="text-xs text-gray-400">Ask an admin to upload a Markdown source for this language.</p>
                </div>
              )}
            </div>
          )}

          {studyTab === 'your_source' && (
            <div>
              {!editingSource && selectedUserSource ? (
                <div>
                  <div className="mb-4 flex flex-col gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 dark:border-[#30363D] dark:bg-[#1C2128] sm:flex-row sm:items-center sm:justify-between">
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      Your {sourceLanguageLabel(sourceLanguage).toLowerCase()} source material
                      {selectedUserSourceFileName ? <span className="ml-1 text-gray-400">· {selectedUserSourceFileName}</span> : null}
                    </span>
                    <button onClick={() => { setSourceDraft(selectedUserSource ?? ''); setSourceDraftFileName(selectedUserSourceFileName); setEditingSource(true) }} className="flex min-h-9 flex-shrink-0 items-center gap-1 self-start rounded-md px-2 text-xs font-medium text-brand-600 transition-colors hover:bg-brand-50 hover:text-brand-800 dark:hover:bg-brand-900/20 sm:self-auto"><Pencil size={13} /> Edit</button>
                  </div>
                  <SimplifiableContent content={selectedUserSource} topicName={topic.name} preserveBreaks headingIdPrefix={headingIdPrefix} />
                </div>
              ) : !editingSource ? (
                <div className="py-16 text-center">
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Add your own {sourceLanguageLabel(sourceLanguage).toLowerCase()} source material for this topic</p>
                  <button onClick={() => { setSourceDraft(''); setSourceDraftFileName(null); setEditingSource(true) }} className="min-h-10 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white transition-all duration-150 hover:bg-brand-800 active:scale-[0.98]">Upload Markdown</button>
                </div>
              ) : (
                <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-[#30363D] dark:bg-[#161B22]">
                  <input ref={fileInputRef} type="file" accept=".md,.markdown,text/markdown" onChange={handleSourceFile} className="hidden" />
                  <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <button onClick={() => fileInputRef.current?.click()} disabled={uploadingSource} className="flex min-h-9 items-center justify-center gap-1.5 rounded-lg border border-brand-200 px-3 py-1.5 text-xs font-medium text-brand-600 transition-colors hover:bg-brand-50 disabled:opacity-50 dark:border-brand-800 dark:hover:bg-brand-900/20 sm:justify-start">
                      {uploadingSource ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
                      {uploadingSource ? 'Reading…' : 'Upload MD'}
                    </button>
                    <span className="text-xs text-gray-400">{sourceLanguageLabel(sourceLanguage)} source</span>
                  </div>
                  <textarea value={sourceDraft} onChange={e => setSourceDraft(e.target.value)} rows={14} placeholder={`Paste your ${sourceLanguageLabel(sourceLanguage).toLowerCase()} source Markdown here, or upload a .md file…`} className="w-full text-sm font-mono text-gray-700 dark:text-gray-100 dark:bg-transparent border border-gray-200 dark:border-[#30363D] rounded-lg p-3 resize-y focus:outline-none focus:ring-2 focus:ring-brand-400/30 focus:border-brand-400" />
                  <div className="flex justify-end gap-2 mt-3">
                    <button onClick={() => { setEditingSource(false); setSourceDraft(selectedUserSource ?? ''); setSourceDraftFileName(selectedUserSourceFileName) }} className="min-h-9 rounded-md px-3 py-1.5 text-xs text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-[#1C2128]">Cancel</button>
                    <button onClick={saveSource} disabled={savingSource || uploadingSource} className="flex min-h-9 items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-brand-800 disabled:opacity-50">
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
              {!generating && topicNote?.study_note && <SimplifiableContent content={topicNote.study_note} topicName={topic.name} headingIdPrefix={headingIdPrefix} />}
              {notes.length > 0 && (
                <div className="mt-6 pt-4 border-t border-gray-100 dark:border-[#21262D]">
                  <p className="text-xs font-medium text-gray-500 mb-2">Your notes ({notes.length})</p>
                  <div className="space-y-2">
                    {notes.map(a => (<div key={a.id} className="bg-gray-50 dark:bg-[#1C2128] rounded-lg px-3 py-2.5"><p className="text-sm text-gray-700 dark:text-gray-300">{a.content}</p><p className="text-xs text-gray-400 mt-1">{relativeDate(a.created_at)}</p></div>))}
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

          {studyTab === 'keypoints' && (
            <div>
              {extracting ? (
                <div className="py-12 text-center"><div className="w-5 h-5 border-2 border-gray-200 border-t-brand-600 rounded-full animate-spin mx-auto mb-3" /><p className="text-sm text-gray-400">Extracting key points…</p></div>
              ) : editingKeyPoints ? (
                <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-[#30363D] dark:bg-[#161B22]">
                  <input ref={keyPointsFileInputRef} type="file" accept=".md,.markdown,text/markdown" onChange={handleKeyPointsFile} className="hidden" />
                  <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <button onClick={() => keyPointsFileInputRef.current?.click()} disabled={uploadingKeyPoints} className="flex min-h-9 items-center justify-center gap-1.5 rounded-lg border border-brand-200 px-3 py-1.5 text-xs font-medium text-brand-600 transition-colors hover:bg-brand-50 disabled:opacity-50 dark:border-brand-800 dark:hover:bg-brand-900/20 sm:justify-start">
                      {uploadingKeyPoints ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
                      {uploadingKeyPoints ? 'Reading…' : 'Upload MD'}
                    </button>
                    <span className="text-xs text-gray-400">{keyPointsDraftFileName ?? userKeyPoints?.file_name ?? 'Markdown key points'}</span>
                  </div>
                  <textarea value={keyPointsDraft} onChange={e => { setKeyPointsDraft(e.target.value); setKeyPointsDraftFileName(null) }} rows={12} placeholder="Paste key points Markdown here, or upload a .md file..." className="w-full resize-y rounded-lg border border-gray-200 p-3 font-mono text-sm text-gray-700 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-400/30 dark:border-[#30363D] dark:bg-transparent dark:text-gray-100" />
                  <div className="mt-3 flex justify-end gap-2">
                    <button onClick={() => { setEditingKeyPoints(false); setKeyPointsDraft(userKeyPoints?.content ?? '') }} className="min-h-9 rounded-md px-3 py-1.5 text-xs text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-[#1C2128]">Cancel</button>
                    <button onClick={saveKeyPoints} disabled={savingKeyPoints || uploadingKeyPoints} className="flex min-h-9 items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-brand-800 disabled:opacity-50">
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
                    <button onClick={() => { setKeyPointsDraft(userKeyPoints?.content ?? topicNote?.key_points ?? ''); setKeyPointsDraftFileName(userKeyPoints?.file_name ?? null); setEditingKeyPoints(true) }} className="flex min-h-9 flex-shrink-0 items-center gap-1 self-start rounded-md px-2 text-xs font-medium text-brand-600 transition-colors hover:bg-brand-50 hover:text-brand-800 dark:hover:bg-brand-900/20 sm:self-auto">
                      {userKeyPoints ? <><Pencil size={13} /> Edit</> : <><Upload size={13} /> Upload MD</>}
                    </button>
                  </div>
                  <Markdown headingIdPrefix={headingIdPrefix}>{effectiveKeyPoints}</Markdown>
                </div>
              ) : (
                <div className="py-12 text-center">
                  <p className="text-sm text-gray-400 mb-1">No key points yet</p>
                  <p className="text-xs text-gray-400 mb-4">Generate the study note or upload Markdown key points.</p>
                  <button onClick={() => { setKeyPointsDraft(''); setKeyPointsDraftFileName(null); setEditingKeyPoints(true) }} className="min-h-10 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white transition-all duration-150 hover:bg-brand-800 active:scale-[0.98]">Upload Markdown</button>
                </div>
              )}
            </div>
          )}

          {studyTab === 'tips' && (<div>{extracting ? (<div className="py-12 text-center"><div className="w-5 h-5 border-2 border-gray-200 border-t-brand-600 rounded-full animate-spin mx-auto mb-3" /><p className="text-sm text-gray-400">Extracting exam tips…</p></div>) : topicNote?.exam_tips ? <Markdown headingIdPrefix={headingIdPrefix}>{topicNote.exam_tips}</Markdown> : (<div className="py-12 text-center"><p className="text-sm text-gray-400 mb-1">No exam tips yet</p><p className="text-xs text-gray-400">Generate the study note to populate this tab automatically</p></div>)}</div>)}
          </div>

          {(studyTab === 'note' || studyTab === 'source' || studyTab === 'your_source') && (
            <div className="fixed bottom-16 md:bottom-4 left-0 right-0 md:left-60 flex justify-center px-4 pointer-events-none z-30">
              <div className="bg-white dark:bg-[#161B22] border border-gray-200 dark:border-[#30363D] rounded-xl px-3 py-2 flex items-center gap-2 shadow-sm pointer-events-auto">
                <button
                  className="xl:hidden flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-brand-600 hover:bg-brand-50 rounded-lg transition-colors"
                  onClick={() => openChat(topic.id, topic.name)}
                  title={`Ask AI (${shortcutLabel('mod+k')})`}
                  aria-label={`Ask AI (${shortcutLabel('mod+k')})`}
                >
                  <MessageSquare size={14} />Ask AI
                </button>
                <div className="xl:hidden w-px h-4 bg-gray-200 dark:bg-[#30363D]" />
                <button
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-50 rounded-lg transition-colors"
                  onClick={() => setShowAnnotation(true)}
                  title={`Add note (${shortcutLabel('mod+shift+a')})`}
                  aria-label={`Add note (${shortcutLabel('mod+shift+a')})`}
                >
                  <Plus size={14} />Add note
                </button>
                <div className="w-px h-4 bg-gray-200 dark:bg-[#30363D]" />
                <button
                  onClick={() => handleStatusChange('done')}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-brand-600 hover:bg-brand-800 rounded-lg transition-colors"
                  title={`Mark done (${shortcutLabel('mod+enter')})`}
                >
                  Mark done
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {popover && <HighlightPopover popover={popover} onPick={pick} onRemove={removeHighlight} />}
      <KeyboardShortcutsDialog open={shortcutsOpen} onOpenChange={setShortcutsOpen} shortcuts={shortcuts} />
      <ScrollToTop />
    </div>
  )

  const left = selectedSubtopic
    ? <SubtopicDetail topic={topic} subtopic={selectedSubtopic} onBack={() => setSelectedSubtopic(null)} />
    : topicView

  return (
    <>
      {left}

      {/* Reopen tab when the desktop rail is hidden (xl only) */}
      {!docked && (
        <button
          onClick={() => dock(topic.id, topic.name)}
          aria-label="Show AI chat"
          title="Show AI chat"
          className="group hidden xl:flex fixed right-0 top-1/2 -translate-y-1/2 z-30 flex-col items-center gap-2.5 pl-2 pr-1.5 py-4 rounded-l-2xl bg-brand-600 text-white shadow-lg ring-1 ring-black/5 hover:bg-brand-800 hover:pr-2.5 transition-[background-color,padding] duration-200 animate-in fade-in slide-in-from-right-2 motion-reduce:animate-none"
        >
          <span className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center group-hover:bg-white/25 transition-colors">
            <Sparkles size={16} strokeWidth={2.2} />
          </span>
          <span className="text-[10px] font-bold tracking-[0.15em] [writing-mode:vertical-rl] rotate-180">ASK&nbsp;AI</span>
        </button>
      )}
    </>
  )
}
