'use client'

import { useMemo } from 'react'
import { Target, TrendingUp, FileText, AlertTriangle } from 'lucide-react'
import type { Topic } from '@/types/database'

export interface ScoreEntry {
  topic_id: string
  score_pct: number
}

interface Props {
  topics: Topic[]
  scores: ScoreEntry[]
  totalAttempts: number
  onSelectTopic: (id: string) => void
}

export function StudyDashboard({ topics, scores, totalAttempts, onSelectTopic }: Props) {
  const stats = useMemo(() => {
    const doneCount = topics.filter(t => t.status === 'done').length
    const avgScore = scores.length > 0 ? Math.round(scores.reduce((s, e) => s + e.score_pct, 0) / scores.length) : 0

    const byTopic = new Map<string, number[]>()
    scores.forEach(s => {
      const arr = byTopic.get(s.topic_id) ?? []
      arr.push(s.score_pct)
      byTopic.set(s.topic_id, arr)
    })

    const weakTopics = topics.filter(t => {
      const ts = byTopic.get(t.id)
      if (!ts || ts.length === 0) return false
      return ts.reduce((a, b) => a + b, 0) / ts.length < 50
    })

    return { doneCount, totalTopics: topics.length, avgScore, weakTopics }
  }, [topics, scores])

  return (
    <div className="mb-5">
      <div className="grid grid-cols-3 gap-2.5 mb-3">
        <div className="bg-white dark:bg-[#161B22] border border-gray-200 dark:border-[#30363D] rounded-xl p-3">
          <Target size={14} className="text-brand-500 mb-1.5" />
          <p className="text-lg font-semibold text-gray-900 dark:text-gray-100 tabular-nums">{stats.doneCount}<span className="text-sm font-normal text-gray-400">/{stats.totalTopics}</span></p>
          <p className="text-[10px] text-gray-400 uppercase tracking-wide">Done</p>
        </div>
        <div className="bg-white dark:bg-[#161B22] border border-gray-200 dark:border-[#30363D] rounded-xl p-3">
          <TrendingUp size={14} className="text-teal-500 mb-1.5" />
          <p className="text-lg font-semibold text-gray-900 dark:text-gray-100 tabular-nums">{stats.avgScore}<span className="text-sm font-normal text-gray-400">%</span></p>
          <p className="text-[10px] text-gray-400 uppercase tracking-wide">Avg score</p>
        </div>
        <div className="bg-white dark:bg-[#161B22] border border-gray-200 dark:border-[#30363D] rounded-xl p-3">
          <FileText size={14} className="text-purple-500 mb-1.5" />
          <p className="text-lg font-semibold text-gray-900 dark:text-gray-100 tabular-nums">{totalAttempts}</p>
          <p className="text-[10px] text-gray-400 uppercase tracking-wide">Attempts</p>
        </div>
      </div>

      {stats.totalTopics > 0 && (
        <div className="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden mb-3">
          <div className="h-full bg-success-400 rounded-full transition-all duration-500" style={{ width: `${(stats.doneCount / stats.totalTopics) * 100}%` }} />
        </div>
      )}

      {stats.weakTopics.length > 0 && (
        <div className="flex items-start gap-2 flex-wrap">
          <AlertTriangle size={13} className="text-danger-400 mt-0.5 flex-shrink-0" />
          {stats.weakTopics.map(t => (
            <button key={t.id} onClick={() => onSelectTopic(t.id)} className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-danger-50 text-danger-800 dark:bg-danger-900/20 dark:text-danger-400 hover:bg-danger-100 transition-colors">
              {t.name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
