'use client'

import { useState } from 'react'
import Link from 'next/link'
import { CountdownCard } from './CountdownCard'
import { MetricGrid } from './MetricGrid'
import { TodayPlan } from './TodayPlan'
import { RescueCard } from './RescueCard'
import { WeeklyReviewSection } from './WeeklyReviewSection'
import { QuickActions } from './QuickActions'
import { ActivityFeed } from './ActivityFeed'
import { DailyReview } from './DailyReview'
import { SessionLogSheet } from '@/components/sessions/SessionLogSheet'
import type { PlannedSession, Topic, WeeklyReport, ActivityLog, StudySummary } from '@/types/database'

interface Props {
  name: string
  todayShift: { type: string; study_start: string; study_end: string } | null
  todayPlanned: PlannedSession[]
  sessionCount: number
  totalHours: number
  p1Coverage: number
  p2Coverage: number
  overallReadiness: number
  flaggedTopics: Pick<Topic, 'id' | 'name' | 'ai_priority'>[]
  weeklyReport: WeeklyReport | null
  activities: ActivityLog[]
  dueCardCount: number
  studySummary: StudySummary
}

export function DashboardClient(props: Props) {
  const [sessionOpen, setSessionOpen] = useState(false)

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  const shiftLabel = props.todayShift
    ? `${props.todayShift.study_start.slice(0,5)}–${props.todayShift.study_end.slice(0,5)} · Shift ${props.todayShift.type}`
    : null

  return (
    <div className="space-y-4">
      {/* Greeting */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-medium text-gray-900 dark:text-gray-100">{greeting}, {props.name}</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {shiftLabel ? `Study window ${shiftLabel}` : 'No shift data for today'}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {props.todayShift && (
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-brand-50 text-brand-800 border border-brand-100 dark:border-brand-900/40">
              Shift {props.todayShift.type}
            </span>
          )}
          <Link
            href="/profile"
            aria-label="Open profile"
            className="md:hidden w-9 h-9 rounded-full bg-brand-600 text-white flex items-center justify-center text-sm font-semibold hover:bg-brand-800 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
          >
            {(props.name || '?').trim().charAt(0).toUpperCase()}
          </Link>
        </div>
      </div>

      {/* Countdown + Readiness */}
      <CountdownCard
        readiness={props.overallReadiness}
        sessionCount={props.sessionCount}
        totalHours={props.totalHours}
      />

      <TodayStudyCard summary={props.studySummary} />

      {/* AI Rescue alert */}
      {props.flaggedTopics.length > 0 && (
        <RescueCard topics={props.flaggedTopics} />
      )}

      {/* Daily review */}
      <DailyReview dueCardCount={props.dueCardCount} />

      {/* 2-col on desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Today's plan */}
        <TodayPlan
          sessions={props.todayPlanned}
          onLogSession={() => setSessionOpen(true)}
        />

        {/* Metrics */}
        <MetricGrid
          sessionCount={props.sessionCount}
          totalHours={props.totalHours}
          p1Coverage={props.p1Coverage}
          p2Coverage={props.p2Coverage}
        />
      </div>

      {/* Weekly report */}
      <WeeklyReviewSection report={props.weeklyReport} />

      {/* Activity feed */}
      <ActivityFeed activities={props.activities} />

      {/* Quick actions */}
      <QuickActions onLogSession={() => setSessionOpen(true)} />

      <SessionLogSheet open={sessionOpen} onOpenChange={setSessionOpen} />
    </div>
  )
}

function TodayStudyCard({ summary }: { summary: StudySummary }) {
  const values = [
    { label: 'Studied', value: `${Math.round(summary.actualMinutes)}m` },
    { label: 'Focus', value: summary.focusSessions },
    { label: 'Topics', value: summary.topicsTouched },
    { label: 'Plan', value: `${Math.round(summary.actualMinutes)}/${summary.plannedMinutes}m` },
    { label: 'Streak', value: `${summary.currentStreak}d` },
  ]

  return (
    <div className="bg-white dark:bg-[#161B22] border border-gray-200 dark:border-[#30363D] rounded-xl p-4">
      <div className="flex items-center justify-between gap-3 mb-3">
        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Today&apos;s study</p>
        <Link href="/progress" className="text-xs font-medium text-brand-600 hover:text-brand-800 dark:text-brand-400 dark:hover:text-brand-300 transition-colors">
          Analytics
        </Link>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        {values.map(item => (
          <div key={item.label} className="rounded-lg bg-gray-50 dark:bg-[#0D1117] border border-gray-100 dark:border-[#30363D] px-3 py-2">
            <p className="text-[11px] text-gray-400">{item.label}</p>
            <p className="mt-1 text-lg font-semibold tabular-nums text-gray-900 dark:text-gray-100">{item.value}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
