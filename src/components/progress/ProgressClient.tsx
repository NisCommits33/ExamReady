'use client'

import { useState } from 'react'
import { ProgressBar } from '@/components/shared/ProgressBar'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { IQ_QUESTION_TYPES } from '@/lib/constants'
import Link from 'next/link'
import { Sparkles, Lightbulb, Dumbbell } from 'lucide-react'
import { cn, relativeDate, coveragePct } from '@/lib/utils'
import type { Topic, IQStats, DrillResult, StudySummary } from '@/types/database'
import { daysToExam } from '@/lib/utils'

interface ProgressClientProps {
  topics: Topic[]
  p1Coverage: number
  p2Coverage: number
  overallReadiness: number
  iqStats: IQStats[]
  sureCalibration: number | null
  drills: DrillResult[]
  dueReviews: number
  fluentTopics: number
  explanationCount: number
  studySummary: StudySummary
}

const SECTION_META: Record<string, { label: string; color: string; fallback: string }> = {
  gk:   { label: 'GK',   color: 'bg-brand-50 text-brand-800',   fallback: 'GK drill' },
  iq:   { label: 'IQ',   color: 'bg-purple-50 text-purple-800', fallback: 'IQ drill' },
  arff: { label: 'ARFF', color: 'bg-teal-50 text-teal-800',     fallback: 'Mock exam' },
}

export function ProgressClient({ topics, p1Coverage, p2Coverage, overallReadiness, iqStats, sureCalibration, drills, dueReviews, fluentTopics, explanationCount, studySummary }: ProgressClientProps) {
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

      {/* Learning techniques */}
      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">Learning techniques</p>
        <div className="grid grid-cols-3 gap-2">
          <Link href="/review" className="flex flex-col items-center gap-1 py-3 rounded-lg bg-teal-50 hover:bg-teal-100 transition-colors">
            <Sparkles size={16} className="text-teal-500" />
            <span className="text-lg font-semibold text-gray-900 tabular-nums">{dueReviews}</span>
            <span className="text-[10px] text-gray-500 text-center leading-tight">cards due<br />to review</span>
          </Link>
          <div className="flex flex-col items-center gap-1 py-3 rounded-lg bg-purple-50">
            <Dumbbell size={16} className="text-purple-500" />
            <span className="text-lg font-semibold text-gray-900 tabular-nums">{fluentTopics}</span>
            <span className="text-[10px] text-gray-500 text-center leading-tight">topics<br />fluent</span>
          </div>
          <div className="flex flex-col items-center gap-1 py-3 rounded-lg bg-amber-50">
            <Lightbulb size={16} className="text-amber-500" />
            <span className="text-lg font-semibold text-gray-900 tabular-nums">{explanationCount}</span>
            <span className="text-[10px] text-gray-500 text-center leading-tight">Feynman<br />explanations</span>
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

      <StudyAnalytics summary={studySummary} />

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

      {/* Recent drill history */}
      {drills.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-sm font-medium text-gray-900 mb-3">Recent drills</p>
          <div className="space-y-2">
            {drills.slice(0, 10).map(d => {
              const meta = SECTION_META[d.section] ?? { label: d.section.toUpperCase(), color: 'bg-gray-100 text-gray-600', fallback: 'Drill' }
              const pct = d.total > 0 ? Math.round((d.score / d.total) * 100) : 0
              const scoreColor = pct >= 70 ? 'text-success-600' : pct >= 50 ? 'text-warning-600' : 'text-danger-500'
              const label = (d.topics as { name: string } | null)?.name ?? meta.fallback
              return (
                <div key={d.id} className="flex items-center gap-3">
                  <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0', meta.color)}>{meta.label}</span>
                  <p className="text-xs text-gray-700 flex-1 truncate">{label}</p>
                  <span className="text-[11px] text-gray-400 flex-shrink-0">{relativeDate(d.created_at)}</span>
                  <span className={cn('text-xs font-semibold tabular-nums w-12 text-right flex-shrink-0', scoreColor)}>{d.score}/{d.total}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Confidence calibration */}
      {sureCalibration !== null && (
        <div className="bg-purple-50 border border-purple-100 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[11px] font-semibold text-purple-800 bg-white px-1.5 py-0.5 rounded-full">AI</span>
            <p className="text-sm font-medium text-purple-900">Confidence calibration</p>
          </div>
          <p className="text-sm text-purple-800 leading-relaxed">
            When you say <strong>Sure</strong>, you&apos;re right <strong>{sureCalibration}%</strong> of the time.
            {sureCalibration < 70 && ' Consider slowing down on questions you feel sure about.'}
            {sureCalibration >= 70 && ' Your confidence is well-calibrated.'}
          </p>
        </div>
      )}
    </div>
  )
}

function StudyAnalytics({ summary }: { summary: StudySummary }) {
  const daily = summary.dailyMinutes.slice(-14)
  const maxDaily = Math.max(1, ...daily.map(item => item.minutes))
  const accuracy = summary.practiceAccuracy.slice(-7)

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <div className="flex items-center justify-between gap-3 mb-4">
        <p className="text-sm font-medium text-gray-900">Study analytics</p>
        <span className="text-xs text-gray-400 tabular-nums">{Math.round(summary.actualMinutes)}m in range</span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
        {[
          ['Focus sessions', summary.focusSessions],
          ['Topics touched', summary.topicsTouched],
          ['Planned', `${summary.plannedMinutes}m`],
          ['Streak', `${summary.currentStreak}d`],
        ].map(([label, value]) => (
          <div key={label} className="rounded-lg bg-gray-50 border border-gray-100 px-3 py-2">
            <p className="text-[11px] text-gray-400">{label}</p>
            <p className="mt-1 text-lg font-semibold text-gray-900 tabular-nums">{value}</p>
          </div>
        ))}
      </div>

      {daily.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-medium text-gray-500 mb-2">Daily minutes</p>
          <div className="flex items-end gap-1.5 h-24">
            {daily.map(item => (
              <div key={item.date} className="flex-1 min-w-0 flex flex-col items-center gap-1">
                <div className="w-full rounded-t bg-brand-400" style={{ height: `${Math.max(6, (item.minutes / maxDaily) * 84)}px` }} />
                <span className="text-[10px] text-gray-400 tabular-nums">{item.date.slice(5)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <p className="text-xs font-medium text-gray-500 mb-2">Time by topic</p>
          <div className="space-y-2">
            {summary.topicMinutes.length > 0 ? summary.topicMinutes.slice(0, 6).map(item => (
              <div key={item.topicId ?? item.topicName} className="flex items-center gap-2">
                <p className="text-xs text-gray-700 flex-1 truncate">{item.topicName}</p>
                <span className="text-xs font-medium text-gray-900 tabular-nums">{Math.round(item.minutes)}m</span>
              </div>
            )) : <p className="text-xs text-gray-400">No tracked topic time yet.</p>}
          </div>
        </div>

        <div>
          <p className="text-xs font-medium text-gray-500 mb-2">Practice accuracy</p>
          <div className="space-y-2">
            {accuracy.length > 0 ? accuracy.map(item => (
              <div key={item.date} className="flex items-center gap-2">
                <span className="text-xs text-gray-400 w-11 tabular-nums">{item.date.slice(5)}</span>
                <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className={cn('h-full', item.pct >= 70 ? 'bg-success-400' : item.pct >= 50 ? 'bg-warning-400' : 'bg-danger-400')} style={{ width: `${item.pct}%` }} />
                </div>
                <span className="text-xs text-gray-700 w-9 text-right tabular-nums">{item.pct}%</span>
              </div>
            )) : <p className="text-xs text-gray-400">No tracked practice yet.</p>}
          </div>
        </div>
      </div>

      {summary.neglectedTopics.length > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-100">
          <p className="text-xs font-medium text-gray-500 mb-2">Neglected topics</p>
          <div className="space-y-2">
            {summary.neglectedTopics.slice(0, 5).map(topic => (
              <Link key={topic.id} href={`/topics/${topic.id}`} className="flex items-center gap-2 text-xs hover:bg-gray-50 rounded-md py-1.5">
                <span className="text-gray-700 flex-1 truncate">{topic.name}</span>
                <span className="text-gray-400 flex-shrink-0">{topic.reason}</span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
