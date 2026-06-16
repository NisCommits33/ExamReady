'use client'

import { useState } from 'react'
import { IQTypeGrid } from './IQTypeGrid'
import { IQDrillSession } from './IQDrillSession'
import { IQ_QUESTION_TYPES } from '@/lib/constants'
import type { IQStats, IQType } from '@/types/database'

interface IQClientProps {
  stats: IQStats[]
  totalAttempted: number
  avgAccuracy: number
  avgTime: number
}

export function IQClient({ stats, totalAttempted, avgAccuracy, avgTime }: IQClientProps) {
  const [selectedType, setSelectedType] = useState<IQType | 'random' | null>(null)

  if (selectedType) {
    return (
      <IQDrillSession
        type={selectedType}
        onBack={() => setSelectedType(null)}
      />
    )
  }

  const weakestStat = [...stats]
    .filter(s => s.total_attempted > 0)
    .sort((a, b) => a.accuracy_pct - b.accuracy_pct)[0]
  const weakestLabel = weakestStat
    ? IQ_QUESTION_TYPES.find(t => t.id === weakestStat.type)?.label
    : null

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-medium text-gray-900 dark:text-gray-100">IQ Practice</h1>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <StatCard label="Accuracy" value={totalAttempted > 0 ? `${avgAccuracy}%` : '—'} />
        <StatCard label="Avg / Q" value={avgTime > 0 ? `${avgTime}s` : '—'} />
        <StatCard label="Drilled" value={totalAttempted.toString()} />
      </div>

      {weakestLabel && (
        <div className="bg-warning-50 border border-warning-400/30 rounded-xl px-4 py-3 mb-4 text-xs text-warning-800">
          Weakest type: <strong>{weakestLabel}</strong> — focus here next
        </div>
      )}

      {/* Type grid */}
      <IQTypeGrid stats={stats} onSelectType={setSelectedType} />

      {/* Random mix */}
      <button
        onClick={() => setSelectedType('random')}
        className="mt-4 w-full py-3.5 bg-brand-600 text-white text-sm font-medium rounded-xl hover:bg-brand-800 transition-colors active:scale-[0.98]"
      >
        Random mix · 10 Qs
      </button>
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white dark:bg-[#161B22] border border-gray-200 dark:border-[#30363D] rounded-xl p-4 text-center">
      <p className="text-xl font-medium text-gray-900 dark:text-gray-100 tabular-nums">{value}</p>
      <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{label}</p>
    </div>
  )
}
