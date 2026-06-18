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
import type { PlannedSession, Topic, WeeklyReport, ActivityLog } from '@/types/database'

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
  numberCount: number
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

      {/* AI Rescue alert */}
      {props.flaggedTopics.length > 0 && (
        <RescueCard topics={props.flaggedTopics} />
      )}

      {/* Daily review */}
      <DailyReview dueCardCount={props.dueCardCount} numberCount={props.numberCount} />

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
