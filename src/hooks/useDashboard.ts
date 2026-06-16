'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { PlannedSession, Topic, WeeklyReport } from '@/types/database'

export interface DashboardData {
  todayShift: { type: string; study_start: string; study_end: string } | null
  todayPlanned: PlannedSession[]
  sessionCount: number
  totalHours: number
  p1Coverage: number
  p2Coverage: number
  flaggedTopics: Topic[]
  weeklyReport: WeeklyReport | null
  loading: boolean
}

export function useDashboard(): DashboardData {
  const [data, setData] = useState<Omit<DashboardData, 'loading'>>({
    todayShift: null,
    todayPlanned: [],
    sessionCount: 0,
    totalHours: 0,
    p1Coverage: 0,
    p2Coverage: 0,
    flaggedTopics: [],
    weeklyReport: null,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const today = new Date().toISOString().split('T')[0]

      const [shift, planned, sessions, topics, report] = await Promise.all([
        supabase.from('shifts').select('type,study_start,study_end').eq('date', today).single(),
        supabase.from('planned_sessions').select('*,topics(name,paper,section)').eq('scheduled_date', today).order('slot_time'),
        supabase.from('sessions').select('duration_mins'),
        supabase.from('topics').select('paper,status,is_flagged'),
        supabase.from('weekly_reports').select('*').order('week_start', { ascending: false }).limit(1).single(),
      ])

      const allTopics = topics.data ?? []
      const p1 = allTopics.filter(t => t.paper === 1)
      const p2 = allTopics.filter(t => t.paper === 2)
      const pct = (arr: typeof allTopics) =>
        arr.length ? Math.round((arr.filter(t => t.status === 'done').length / arr.length) * 100) : 0

      const totalMins = (sessions.data ?? []).reduce((s, r) => s + r.duration_mins, 0)

      setData({
        todayShift: shift.data,
        todayPlanned: (planned.data ?? []) as PlannedSession[],
        sessionCount: sessions.data?.length ?? 0,
        totalHours: Math.round(totalMins / 60 * 10) / 10,
        p1Coverage: pct(p1),
        p2Coverage: pct(p2),
        flaggedTopics: (topics.data ?? []).filter(t => t.is_flagged) as Topic[],
        weeklyReport: report.data ?? null,
      })
      setLoading(false)
    }
    load()
  }, [])

  return { ...data, loading }
}
