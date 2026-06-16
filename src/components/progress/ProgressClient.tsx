'use client'

import { useState } from 'react'
import { ProgressBar } from '@/components/shared/ProgressBar'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { IQ_QUESTION_TYPES } from '@/lib/constants'
import { cn, relativeDate, coveragePct } from '@/lib/utils'
import type { Topic, IQStats } from '@/types/database'
import { daysToExam } from '@/lib/utils'

interface ProgressClientProps {
  topics: Topic[]
  p1Coverage: number
  p2Coverage: number
  overallReadiness: number
  iqStats: IQStats[]
  sureCalibration: number | null
}

export function ProgressClient({ topics, p1Coverage, p2Coverage, overallReadiness, iqStats, sureCalibration }: ProgressClientProps) {
  const [paperFilter, setPaperFilter] = useState<'all' | 1 | 2>('all')
  const [showAll, setShowAll] = useState(false)

  const displayed = topics.filter(t => paperFilter === 'all' || t.paper === paperFilter)
  const visibleTopics = showAll ? displayed : displayed.slice(0, 8)
  const atRisk = topics.filter(t => t.status === 'not_started' && (t.ai_priority ?? 5) >= 7)
  const statsMap = Object.fromEntries(iqStats.map(s => [s.type, s]))
  const radius = 15.9
  const circumference = 2 * Math.PI * radius
  const days = daysToExam()

  return (
    <div className="space-y-5">
      <h1 className="text-lg font-medium text-gray-900">Progress</h1>

      {/* Readiness card */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">Overall readiness</p>
            <div className="space-y-3">
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-xs text-gray-600">Paper 1</span>
                  <span className="text-xs font-medium text-gray-900 tabular-nums">{p1Coverage}%</span>
                </div>
                <ProgressBar value={p1Coverage} color="bg-brand-400" />
              </div>
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-xs text-gray-600">Paper 2</span>
                  <span className="text-xs font-medium text-gray-900 tabular-nums">{p2Coverage}%</span>
                </div>
                <ProgressBar value={p2Coverage} color="bg-teal-400" />
              </div>
            </div>
          </div>

          {/* Donut */}
          <div className="flex-shrink-0 flex flex-col items-center">
            <svg width="80" height="80" viewBox="0 0 40 40" className="-rotate-90">
              <circle cx="20" cy="20" r={radius} fill="none" stroke="#E5E7EB" strokeWidth="4" />
              <circle
                cx="20" cy="20" r={radius} fill="none"
                stroke="#185FA5" strokeWidth="4" strokeLinecap="round"
                strokeDasharray={`${(overallReadiness / 100) * circumference} ${circumference}`}
              />
            </svg>
            <div className="text-center -mt-[68px] mb-[16px] pointer-events-none">
              <p className="text-lg font-semibold text-gray-900">{overallReadiness}%</p>
              <p className="text-[9px] text-gray-400 font-medium uppercase tracking-wide">READY</p>
            </div>
          </div>
        </div>
      </div>

      {/* At-risk topics */}
      {atRisk.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-4 border-l-danger">
          <p className="text-xs font-semibold text-danger-400 uppercase tracking-wide mb-3">At risk · {days} days left</p>
          <div className="space-y-2">
            {atRisk.slice(0, 5).map((t, i) => (
              <div key={t.id} className="flex items-center gap-2">
                <span className="text-xs text-gray-400 w-4 tabular-nums">{i + 1}.</span>
                <p className="text-sm text-gray-700 flex-1 truncate">{t.name}</p>
                <span className="text-[11px] text-danger-400 font-medium">P{t.ai_priority}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Topic coverage */}
      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-medium text-gray-900">Topic coverage</p>
          <div className="flex gap-1">
            {(['all', 1, 2] as const).map(f => (
              <button
                key={f}
                onClick={() => setPaperFilter(f)}
                className={cn(
                  'px-2.5 py-1 rounded text-xs font-medium transition-colors',
                  paperFilter === f ? 'bg-brand-50 text-brand-700' : 'text-gray-400 hover:text-gray-600'
                )}
              >
                {f === 'all' ? 'All' : `P${f}`}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2.5">
          {visibleTopics.map(t => {
            const pct = coveragePct(t.status, t.mcq_best_score)
            return (
              <div key={t.id} className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <p className={cn('text-xs truncate', t.status === 'done' ? 'text-gray-400' : 'text-gray-700')}>{t.name}</p>
                    <span className="text-xs text-gray-400 tabular-nums ml-2 flex-shrink-0">{pct}%</span>
                  </div>
                  <ProgressBar value={pct} />
                </div>
                <StatusBadge status={t.status} />
              </div>
            )
          })}
        </div>

        {displayed.length > 8 && (
          <button
            onClick={() => setShowAll(s => !s)}
            className="mt-3 text-xs text-brand-600 hover:text-brand-800 transition-colors"
          >
            {showAll ? 'Show less' : `Show all ${displayed.length}`}
          </button>
        )}
      </div>

      {/* IQ accuracy */}
      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <p className="text-sm font-medium text-gray-900 mb-3">IQ accuracy by type</p>
        <div className="space-y-2.5">
          {IQ_QUESTION_TYPES.map(t => {
            const stat = statsMap[t.id]
            const pct = stat?.accuracy_pct ?? 0
            const attempted = stat?.total_attempted ?? 0
            const barColor = pct >= 70 ? 'bg-success-400' : pct >= 50 ? 'bg-warning-400' : 'bg-danger-400'
            return (
              <div key={t.id} className="flex items-center gap-3">
                <p className="text-xs text-gray-600 w-32 flex-shrink-0 truncate">{t.label}</p>
                <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className={cn('h-full rounded-full transition-all', attempted > 0 ? barColor : 'bg-gray-200')} style={{ width: `${pct}%` }} />
                </div>
                <span className={cn('text-xs tabular-nums w-8 text-right', attempted > 0 ? 'text-gray-700' : 'text-gray-300')}>
                  {attempted > 0 ? `${Math.round(pct)}%` : '—'}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Confidence calibration */}
      {sureCalibration !== null && (
        <div className="bg-purple-50 border border-purple-100 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[11px] font-semibold text-purple-800 bg-white px-1.5 py-0.5 rounded-full">AI</span>
            <p className="text-sm font-medium text-purple-900">Confidence calibration</p>
          </div>
          <p className="text-sm text-purple-800 leading-relaxed">
            When you say <strong>Sure</strong>, you're right <strong>{sureCalibration}%</strong> of the time.
            {sureCalibration < 70 && ' Consider slowing down on questions you feel sure about.'}
            {sureCalibration >= 70 && ' Your confidence is well-calibrated.'}
          </p>
        </div>
      )}
    </div>
  )
}
