'use client'

import { useState, useMemo } from 'react'
import { BookOpen, Layers, ClipboardCheck } from 'lucide-react'
import { cn } from '@/lib/utils'
import { TopicDetail } from '@/components/shared/TopicDetail'
import { StudyDashboard, type ScoreEntry } from '@/components/shared/StudyDashboard'
import { StudySearchFilter, type StatusFilter, type SortKey } from '@/components/shared/StudySearchFilter'
import { ScoreSparkline } from '@/components/shared/ScoreSparkline'
import { Flashcards } from '@/components/shared/Flashcards'
import { ARFFMockExam } from './ARFFMockExam'
import { ARFFPracticeTab } from './ARFFPracticeTab'
import type { Topic, P2Answer, TopicStatus } from '@/types/database'

type ActiveMode = 'topics' | 'flashcards' | 'mockexam'

interface Props {
  p2Topics: Topic[]
  p2Answers: P2Answer[]
  topicKeyPoints: { topic_id: string; key_points: string | null }[]
  heading?: string
}

export function ARFFClient({ p2Topics, p2Answers, topicKeyPoints, heading }: Props) {
  const [topics, setTopics] = useState(p2Topics)
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null)
  const [activeMode, setActiveMode] = useState<ActiveMode>('topics')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [sortBy, setSortBy] = useState<SortKey>('default')

  const scores: ScoreEntry[] = useMemo(() =>
    p2Answers.filter(a => a.ai_score != null).map(a => ({
      topic_id: a.topic_id,
      score_pct: ((a.ai_score ?? 0) / (a.question_type === '5mark' ? 5 : 10)) * 100,
    })), [p2Answers])

  const scoresByTopic = useMemo(() => {
    const map = new Map<string, number[]>()
    scores.forEach(s => { const arr = map.get(s.topic_id) ?? []; arr.push(s.score_pct); map.set(s.topic_id, arr) })
    return map
  }, [scores])

  const filteredTopics = useMemo(() => {
    let t = [...topics]
    if (search) { const q = search.toLowerCase(); t = t.filter(x => x.name.toLowerCase().includes(q)) }
    if (statusFilter !== 'all') t = t.filter(x => x.status === statusFilter)
    if (sortBy === 'status') { const o: Record<string, number> = { not_started: 0, in_progress: 1, done: 2 }; t.sort((a, b) => (o[a.status] ?? 0) - (o[b.status] ?? 0)) }
    else if (sortBy === 'score') { t.sort((a, b) => { const as = scoresByTopic.get(a.id) ?? [], bs = scoresByTopic.get(b.id) ?? []; return (bs.length ? bs.reduce((s, v) => s + v, 0) / bs.length : -1) - (as.length ? as.reduce((s, v) => s + v, 0) / as.length : -1) }) }
    else if (sortBy === 'last_attempted') { const la = new Map<string, string>(); p2Answers.forEach(a => { if (!la.has(a.topic_id)) la.set(a.topic_id, a.attempted_at) }); t.sort((a, b) => (la.get(b.id) ?? '').localeCompare(la.get(a.id) ?? '')) }
    return t
  }, [topics, search, statusFilter, sortBy, scoresByTopic, p2Answers])

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
        practiceTab={<ARFFPracticeTab topic={selectedTopic} />}
        practiceLabel="Practice"
      />
    )
  }

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-lg font-medium text-gray-900 dark:text-gray-100">{heading ?? 'ARFF'}</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Study &amp; written practice</p>
      </div>

      <div className="flex bg-gray-100 dark:bg-[#1C2128] rounded-lg p-0.5 mb-5">
        {([
          { key: 'topics' as ActiveMode, icon: BookOpen, label: 'Topics' },
          { key: 'flashcards' as ActiveMode, icon: Layers, label: 'Flashcards' },
          { key: 'mockexam' as ActiveMode, icon: ClipboardCheck, label: 'Mock Exam' },
        ]).map(m => (
          <button key={m.key} onClick={() => setActiveMode(m.key)} className={cn('flex-1 flex items-center justify-center gap-1.5 py-2 text-sm font-medium rounded-md transition-all duration-150', activeMode === m.key ? 'bg-white dark:bg-[#161B22] text-gray-900 dark:text-gray-100 shadow-sm' : 'text-gray-500 dark:text-gray-400')}>
            <m.icon size={13} /> {m.label}
          </button>
        ))}
      </div>

      {activeMode === 'topics' && (
        <>
          <StudyDashboard topics={topics} scores={scores} totalAttempts={p2Answers.length} onSelectTopic={id => setSelectedTopicId(id)} />
          <StudySearchFilter search={search} onSearchChange={setSearch} statusFilter={statusFilter} onStatusFilterChange={setStatusFilter} sortBy={sortBy} onSortChange={setSortBy} />
          <div className="space-y-2">
            {filteredTopics.map(t => {
              const ts = (scoresByTopic.get(t.id) ?? []).slice(-5)
              const recent = p2Answers.find(a => a.topic_id === t.id)
              return (
                <button key={t.id} onClick={() => setSelectedTopicId(t.id)} className="w-full flex items-center justify-between px-4 py-3.5 bg-white dark:bg-[#161B22] border border-gray-200 dark:border-[#30363D] rounded-xl text-left hover:border-teal-400 dark:hover:border-teal-700 transition-all duration-150">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{t.name}</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">§{t.section} · Topic {t.topic_number}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                    <ScoreSparkline scores={ts} />
                    <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded-full', t.status === 'done' ? 'bg-success-50 text-success-800' : t.status === 'in_progress' ? 'bg-warning-50 text-warning-800' : 'bg-gray-100 text-gray-500')}>
                      {t.status === 'done' ? 'Done' : t.status === 'in_progress' ? 'In progress' : 'Not started'}
                    </span>
                    {recent?.ai_score != null && (
                      <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full', recent.ai_score >= (recent.question_type === '5mark' ? 3 : 6) ? 'bg-success-50 text-success-800' : 'bg-warning-50 text-warning-800')}>
                        {recent.ai_score}/{recent.question_type === '5mark' ? 5 : 10}
                      </span>
                    )}
                  </div>
                </button>
              )
            })}
            {filteredTopics.length === 0 && <p className="text-sm text-gray-400 text-center py-8">No topics match your filter</p>}
          </div>
        </>
      )}

      {activeMode === 'flashcards' && <Flashcards topics={topics} topicKeyPoints={topicKeyPoints} />}
      {activeMode === 'mockexam' && <ARFFMockExam topics={topics} allScores={p2Answers} onBack={() => setActiveMode('topics')} />}
    </div>
  )
}
