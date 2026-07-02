'use client'

import { useState } from 'react'
import { BookOpen, Brain, Layers, Shuffle, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { IQTypeGrid } from './IQTypeGrid'
import { IQDrillSession } from './IQDrillSession'
import { TopicDetail } from '@/components/shared/TopicDetail'
import { Flashcards } from '@/components/shared/Flashcards'
import { AddTopicPanel } from '@/components/topics/AddTopicPanel'
import { IQ_QUESTION_TYPES } from '@/lib/constants'
import type { IQStats, IQType, Topic, TopicStatus } from '@/types/database'

type ActiveMode = 'topics' | 'drills' | 'flashcards'

interface IQClientProps {
  stats: IQStats[]
  totalAttempted: number
  avgAccuracy: number
  avgTime: number
  topics: Topic[]
  topicKeyPoints: { topic_id: string; key_points: string | null }[]
  heading?: string
  sectionId?: string
}

export function IQClient({ stats, totalAttempted, avgAccuracy, avgTime, topics: initialTopics, topicKeyPoints, heading, sectionId }: IQClientProps) {
  const [topics, setTopics] = useState(initialTopics)
  const [activeMode, setActiveMode] = useState<ActiveMode>('drills')
  const [selectedType, setSelectedType] = useState<IQType | 'random' | null>(null)
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null)

  function handleStatusChange(topicId: string, status: TopicStatus) {
    setTopics(prev => prev.map(t => t.id === topicId ? { ...t, status } : t))
  }

  // Drill session (full screen)
  if (selectedType) {
    return <IQDrillSession type={selectedType} onBack={() => setSelectedType(null)} />
  }

  // Topic detail (full screen)
  const selectedTopic = topics.find(t => t.id === selectedTopicId)
  if (selectedTopicId && selectedTopic) {
    return <TopicDetail topic={selectedTopic} onBack={() => setSelectedTopicId(null)} onStatusChange={handleStatusChange} />
  }

  const weakestStat = [...stats].filter(s => s.total_attempted > 0).sort((a, b) => a.accuracy_pct - b.accuracy_pct)[0]
  const weakestLabel = weakestStat ? IQ_QUESTION_TYPES.find(t => t.id === weakestStat.type)?.label : null

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-lg font-medium text-gray-900 dark:text-gray-100">{heading ?? 'IQ Practice'}</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Aptitude drills</p>
      </div>

      {/* Mode selector */}
      <div className="flex bg-gray-100 dark:bg-[#1C2128] rounded-lg p-0.5 mb-5">
        {([
          { key: 'drills' as ActiveMode, icon: Brain, label: 'Drills' },
          { key: 'topics' as ActiveMode, icon: BookOpen, label: 'Topics' },
          { key: 'flashcards' as ActiveMode, icon: Layers, label: 'Flashcards' },
        ]).map(m => (
          <button key={m.key} onClick={() => setActiveMode(m.key)} className={cn('flex-1 flex items-center justify-center gap-1.5 py-2 text-sm font-medium rounded-md transition-all duration-150', activeMode === m.key ? 'bg-white dark:bg-[#161B22] text-gray-900 dark:text-gray-100 shadow-sm' : 'text-gray-500 dark:text-gray-400')}>
            <m.icon size={13} /> {m.label}
          </button>
        ))}
      </div>

      {activeMode === 'drills' && (
        <>
          {/* Hero: overall accuracy + primary drill CTA */}
          <div className="rounded-2xl border border-gray-200 dark:border-[#30363D] bg-gradient-to-br from-brand-50 to-white dark:from-brand-900/20 dark:to-[#161B22] p-5 mb-4">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wide">Overall accuracy</p>
                <p className="text-4xl font-semibold text-gray-900 dark:text-gray-100 tabular-nums leading-tight">
                  {totalAttempted > 0 ? `${avgAccuracy}%` : '—'}
                </p>
                <p className="text-xs text-gray-400 mt-1">{totalAttempted} drilled · {avgTime > 0 ? `${avgTime}s` : '—'} avg</p>
              </div>
              <button onClick={() => setSelectedType('random')} className="flex-shrink-0 flex items-center gap-1.5 px-4 py-3 bg-brand-600 text-white text-sm font-medium rounded-xl hover:bg-brand-800 transition-colors active:scale-[0.98]">
                <Shuffle size={15} /> Random 10
              </button>
            </div>
          </div>

          {weakestLabel && (
            <button onClick={() => weakestStat && setSelectedType(weakestStat.type as IQType)} className="w-full flex items-center gap-2 bg-warning-50 dark:bg-warning-900/15 border border-warning-400/30 rounded-xl px-4 py-3 mb-5 text-xs text-warning-800 dark:text-warning-300 hover:bg-warning-100 dark:hover:bg-warning-900/25 transition-colors text-left">
              <AlertTriangle size={14} className="flex-shrink-0" />
              <span>Weakest type: <strong>{weakestLabel}</strong> — tap to drill it now</span>
            </button>
          )}

          <IQTypeGrid stats={stats} onSelectType={setSelectedType} />
        </>
      )}

      {activeMode === 'topics' && (
        <div className="space-y-2">
          {sectionId && (
            <div className="flex justify-end mb-1">
              <AddTopicPanel sectionId={sectionId} sectionName={heading} onCreated={created => setTopics(prev => [...prev, ...created.map(c => ({ id: c.id, name: c.name, topic_number: c.topic_number, status: 'not_started' } as unknown as Topic))])} />
            </div>
          )}
          {topics.map(t => (
            <button key={t.id} onClick={() => setSelectedTopicId(t.id)} className={cn('w-full flex items-center justify-between px-4 py-3.5 bg-white dark:bg-[#161B22] border rounded-xl text-left transition-all duration-150', t.has_user_source ? 'border-violet-300 dark:border-violet-700 border-l-[3px] border-l-violet-400 dark:border-l-violet-500 hover:border-violet-400' : 'border-gray-200 dark:border-[#30363D] hover:border-brand-400 dark:hover:border-brand-700')}>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{t.name}</p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Topic {t.topic_number}</p>
              </div>
              <span className="flex items-center gap-2 flex-shrink-0 ml-3">
                {t.has_user_source && (
                  <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300" title="You added your own source">Your source</span>
                )}
                <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded-full', t.status === 'done' ? 'bg-success-50 text-success-800' : t.status === 'in_progress' ? 'bg-warning-50 text-warning-800' : 'bg-gray-100 text-gray-500')}>
                  {t.status === 'done' ? 'Done' : t.status === 'in_progress' ? 'In progress' : 'Not started'}
                </span>
              </span>
            </button>
          ))}
          {topics.length === 0 && <p className="text-sm text-gray-400 text-center py-8">No IQ topics found</p>}
        </div>
      )}

      {activeMode === 'flashcards' && <Flashcards topics={topics} topicKeyPoints={topicKeyPoints} />}
    </div>
  )
}
