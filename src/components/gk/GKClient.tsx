'use client'

import { useState, useMemo } from 'react'
import { BookOpen, Layers } from 'lucide-react'
import { cn } from '@/lib/utils'
import { TopicDetail } from '@/components/shared/TopicDetail'
import { StudyDashboard } from '@/components/shared/StudyDashboard'
import { StudySearchFilter, type StatusFilter, type SortKey } from '@/components/shared/StudySearchFilter'
import { Flashcards } from '@/components/shared/Flashcards'
import { GKDrillPanel } from './GKDrillPanel'
import type { Topic, TopicStatus } from '@/types/database'

type ActiveMode = 'topics' | 'flashcards'

interface Props {
  topics: Topic[]
  topicKeyPoints: { topic_id: string; key_points: string | null }[]
  heading?: string
}

export function GKClient({ topics: initialTopics, topicKeyPoints, heading }: Props) {
  const [topics, setTopics] = useState(initialTopics)
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null)
  const [activeMode, setActiveMode] = useState<ActiveMode>('topics')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [sortBy, setSortBy] = useState<SortKey>('default')

  const filteredTopics = useMemo(() => {
    let t = [...topics]
    if (search) { const q = search.toLowerCase(); t = t.filter(x => x.name.toLowerCase().includes(q)) }
    if (statusFilter !== 'all') t = t.filter(x => x.status === statusFilter)
    if (sortBy === 'status') {
      const o: Record<string, number> = { not_started: 0, in_progress: 1, done: 2 }
      t.sort((a, b) => (o[a.status] ?? 0) - (o[b.status] ?? 0))
    }
    return t
  }, [topics, search, statusFilter, sortBy])

  function handleStatusChange(topicId: string, status: TopicStatus) {
    setTopics(prev => prev.map(t => t.id === topicId ? { ...t, status } : t))
  }

  const selectedTopic = topics.find(t => t.id === selectedTopicId)

  if (selectedTopicId && selectedTopic) {
    return (
      <TopicDetail
        topic={selectedTopic}
        onBack={() => setSelectedTopicId(null)}
        onStatusChange={handleStatusChange}
        practiceTab={<GKDrillPanel topic={selectedTopic} />}
        practiceLabel="MCQ Drill"
      />
    )
  }

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-lg font-medium text-gray-900 dark:text-gray-100">{heading ?? 'General Knowledge'}</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Study &amp; practice</p>
      </div>

      <div className="flex bg-gray-100 dark:bg-[#1C2128] rounded-lg p-0.5 mb-5">
        {([
          { key: 'topics' as ActiveMode, icon: BookOpen, label: 'Topics' },
          { key: 'flashcards' as ActiveMode, icon: Layers, label: 'Flashcards' },
        ]).map(m => (
          <button key={m.key} onClick={() => setActiveMode(m.key)} className={cn('flex-1 flex items-center justify-center gap-1.5 py-2 text-sm font-medium rounded-md transition-all duration-150', activeMode === m.key ? 'bg-white dark:bg-[#161B22] text-gray-900 dark:text-gray-100 shadow-sm' : 'text-gray-500 dark:text-gray-400')}>
            <m.icon size={13} /> {m.label}
          </button>
        ))}
      </div>

      {activeMode === 'topics' && (
        <>
          <StudyDashboard topics={topics} scores={[]} totalAttempts={0} onSelectTopic={id => setSelectedTopicId(id)} />
          <StudySearchFilter search={search} onSearchChange={setSearch} statusFilter={statusFilter} onStatusFilterChange={setStatusFilter} sortBy={sortBy} onSortChange={setSortBy} />
          <div className="space-y-2">
            {filteredTopics.map(t => (
              <button key={t.id} onClick={() => setSelectedTopicId(t.id)} className="w-full flex items-center justify-between px-4 py-3.5 bg-white dark:bg-[#161B22] border border-gray-200 dark:border-[#30363D] rounded-xl text-left hover:border-brand-400 dark:hover:border-brand-700 transition-all duration-150">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{t.name}</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Topic {t.topic_number}</p>
                </div>
                <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded-full flex-shrink-0 ml-3', t.status === 'done' ? 'bg-success-50 text-success-800' : t.status === 'in_progress' ? 'bg-warning-50 text-warning-800' : 'bg-gray-100 text-gray-500')}>
                  {t.status === 'done' ? 'Done' : t.status === 'in_progress' ? 'In progress' : 'Not started'}
                </span>
              </button>
            ))}
            {filteredTopics.length === 0 && <p className="text-sm text-gray-400 text-center py-8">No topics match your filter</p>}
          </div>
        </>
      )}

      {activeMode === 'flashcards' && <Flashcards topics={topics} topicKeyPoints={topicKeyPoints} />}
    </div>
  )
}
