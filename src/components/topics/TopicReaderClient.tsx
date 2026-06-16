'use client'

import { useState, useRef } from 'react'
import { ArrowLeft, MessageSquare, Plus } from 'lucide-react'
import { ChatPanel } from '@/components/ai/ChatPanel'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { StatusToggle } from '@/components/shared/StatusToggle'
import { PaperBadge } from '@/components/shared/PaperBadge'
import { LoadingStream, StreamingSkeleton } from '@/components/shared/LoadingStream'
import { DrillTab } from './DrillTab'
import { P2AnswerTab } from './P2AnswerTab'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { cn, relativeDate } from '@/lib/utils'
import { Markdown } from '@/components/ui/Markdown'
import type { Topic, TopicNote, UserAnnotation, P2Answer, TopicStatus } from '@/types/database'

type Tab = 'note' | 'keypoints' | 'tips' | 'drill' | 'p2'

interface Props {
  topic: Topic
  note: TopicNote | null
  annotations: UserAnnotation[]
  answers: P2Answer[]
}

export function TopicReaderClient({ topic, note: initialNote, annotations: initialAnnotations, answers }: Props) {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('note')
  const [note, setNote] = useState<TopicNote | null>(initialNote)
  const [annotations, setAnnotations] = useState(initialAnnotations)
  const [status, setStatus] = useState<TopicStatus>(topic.status)
  const [chatOpen, setChatOpen] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [extracting, setExtracting] = useState(false)
  const [streamText, setStreamText] = useState('')
  const [annotationText, setAnnotationText] = useState('')
  const [showAnnotation, setShowAnnotation] = useState(false)
  const readerRef = useRef<HTMLDivElement>(null)

  const tabs: { key: Tab; label: string }[] = [
    { key: 'note',      label: 'Study note'  },
    { key: 'keypoints', label: 'Key points'  },
    { key: 'tips',      label: 'Exam tips'   },
    { key: 'drill',     label: 'Drill'       },
    ...(topic.paper === 2 ? [{ key: 'p2' as Tab, label: 'Paper 2' }] : []),
  ]

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
      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let full = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value)
        const lines = chunk.split('\n')
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6)
            if (data === '[DONE]') break
            try {
              const json = JSON.parse(data)
              const delta = json.choices?.[0]?.delta?.content ?? ''
              full += delta
              setStreamText(full)
            } catch {}
          }
        }
      }
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
    await supabase.from('topics').update({ status: s }).eq('id', topic.id)
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
              {isLoadingTab && (
                <span className="w-3 h-3 border border-gray-300 border-t-brand-400 rounded-full animate-spin" />
              )}
            </button>
          )
        })}
      </div>

      {/* Tab content */}
      <div ref={readerRef}>
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
            {annotations.length > 0 && (
              <div className="mt-6 pt-4 border-t border-gray-100">
                <p className="text-xs font-medium text-gray-500 mb-2">Your notes ({annotations.length})</p>
                <div className="space-y-2">
                  {annotations.map(a => (
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

        {/* Drill */}
        {tab === 'drill' && <DrillTab topic={topic} />}

        {/* Paper 2 practice */}
        {tab === 'p2' && topic.paper === 2 && <P2AnswerTab topic={topic} answers={answers} existingNote={note} />}
      </div>

      {/* Floating action bar */}
      {(tab === 'note') && (
        <div className="fixed bottom-16 md:bottom-4 left-0 right-0 md:left-60 flex justify-center px-4 pointer-events-none z-30">
          <div className="bg-white dark:bg-[#161B22] border border-gray-200 dark:border-[#30363D] rounded-xl px-3 py-2 flex items-center gap-2 shadow-sm pointer-events-auto">
            <button
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-brand-600 hover:bg-brand-50 rounded-lg transition-colors"
              onClick={() => setChatOpen(true)}
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
      <ChatPanel
        open={chatOpen}
        onClose={() => setChatOpen(false)}
        topicId={topic.id}
        topicName={topic.name}
      />
    </div>
  )
}
