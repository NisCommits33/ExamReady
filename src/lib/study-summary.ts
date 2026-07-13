import { addDays, format, startOfWeek } from 'date-fns'
import type { createClient } from '@/lib/supabase/server'
import type { PaperType, StudyEvent, StudySummary, TopicStatus } from '@/types/database'

type Supabase = Awaited<ReturnType<typeof createClient>>

function dateKey(value: string | Date): string {
  return format(new Date(value), 'yyyy-MM-dd')
}

function minutes(seconds: number): number {
  return Math.round((seconds / 60) * 10) / 10
}

export async function getStudySummary(
  supabase: Supabase,
  opts: { from: string; to: string },
): Promise<StudySummary> {
  const [{ data: events }, { data: planned }, { data: topics }, { data: sessions }] = await Promise.all([
    supabase
      .from('study_events')
      .select('*,topics(name,paper,section)')
      .gte('started_at', `${opts.from}T00:00:00.000Z`)
      .lte('started_at', `${opts.to}T23:59:59.999Z`)
      .order('started_at', { ascending: true }),
    supabase
      .from('planned_sessions')
      .select('scheduled_date,duration_mins,completed')
      .gte('scheduled_date', opts.from)
      .lte('scheduled_date', opts.to),
    supabase
      .from('topics')
      .select('id,name,paper,ai_priority,user_topic_progress(status,last_studied,mcq_best_score)')
      .order('ai_priority', { ascending: false }),
    supabase
      .from('sessions')
      .select('id,date,duration_mins')
      .gte('date', opts.from)
      .lte('date', opts.to),
  ])

  const rows = (events ?? []) as StudyEvent[]
  const byDate = new Map<string, number>()
  const byTopic = new Map<string, { topicId: string | null; topicName: string; seconds: number }>()
  const practice = new Map<string, { correct: number; total: number }>()
  const touched = new Set<string>()

  for (const event of rows) {
    const key = dateKey(event.started_at)
    byDate.set(key, (byDate.get(key) ?? 0) + event.duration_s)
    if (event.topic_id) touched.add(event.topic_id)
    const topicName = event.topics?.name ?? (event.topic_id ? 'Untitled topic' : 'General study')
    const topicKey = event.topic_id ?? 'general'
    const topic = byTopic.get(topicKey) ?? { topicId: event.topic_id, topicName, seconds: 0 }
    topic.seconds += event.duration_s
    byTopic.set(topicKey, topic)

    if (event.source === 'practice') {
      const correct = Number(event.metadata?.correct ?? 0)
      const total = Number(event.metadata?.total ?? 0)
      if (total > 0) {
        const bucket = practice.get(key) ?? { correct: 0, total: 0 }
        bucket.correct += correct
        bucket.total += total
        practice.set(key, bucket)
      }
    }
  }

  const eventSeconds = rows.reduce((sum, event) => sum + event.duration_s, 0)
  const manualEventSessionIds = new Set(rows.map(event => event.metadata?.sessionId).filter(Boolean))
  const legacySessionMinutes = (sessions ?? [])
    .filter((session: { date: string; duration_mins: number; id?: string }) => !session.id || !manualEventSessionIds.has(session.id))
    .reduce((sum: number, session: { duration_mins: number }) => sum + session.duration_mins, 0)
  const plannedMinutes = (planned ?? []).reduce((sum: number, item: { duration_mins: number }) => sum + (item.duration_mins ?? 0), 0)

  const sortedDates = [...byDate.entries()].sort(([a], [b]) => a.localeCompare(b))
  const activeDates = new Set(sortedDates.filter(([, seconds]) => seconds >= 60).map(([date]) => date))
  let streak = 0
  for (let day = new Date(); ; day = addDays(day, -1)) {
    if (activeDates.has(dateKey(day))) streak += 1
    else break
  }

  const weekly = new Map<string, number>()
  for (const [date, seconds] of byDate) {
    const week = dateKey(startOfWeek(new Date(`${date}T00:00:00`), { weekStartsOn: 1 }))
    weekly.set(week, (weekly.get(week) ?? 0) + seconds)
  }

  const allTopics = (topics ?? []).map((topic) => {
    const raw = (topic as { user_topic_progress?: unknown }).user_topic_progress
    const progress = (Array.isArray(raw) ? raw[0] : raw) as { status?: TopicStatus; last_studied?: string | null; mcq_best_score?: number | null } | null
    return {
      id: topic.id as string,
      name: topic.name as string,
      paper: topic.paper as PaperType,
      ai_priority: topic.ai_priority as number,
      status: progress?.status ?? 'not_started',
      lastStudied: progress?.last_studied ?? null,
      mcqBestScore: progress?.mcq_best_score ?? null,
    }
  })
  const neglectedTopics = allTopics
    .filter(topic => topic.status !== 'done')
    .filter(topic => (topic.ai_priority ?? 0) >= 7 || !topic.lastStudied || (topic.mcqBestScore ?? 100) < 60)
    .slice(0, 8)
    .map(topic => ({
      id: topic.id,
      name: topic.name,
      paper: topic.paper,
      ai_priority: topic.ai_priority,
      lastStudied: topic.lastStudied,
      reason: !topic.lastStudied ? 'Never studied' : (topic.mcqBestScore ?? 100) < 60 ? 'Weak practice score' : 'High priority',
    }))

  return {
    minutesStudied: minutes(eventSeconds) + legacySessionMinutes,
    focusSessions: rows.filter(event => event.event_type === 'pomodoro_focus').length,
    topicsTouched: touched.size,
    plannedMinutes,
    actualMinutes: minutes(eventSeconds) + legacySessionMinutes,
    currentStreak: streak,
    dailyMinutes: sortedDates.map(([date, seconds]) => ({ date, minutes: minutes(seconds) })),
    weeklyMinutes: [...weekly.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([weekStart, seconds]) => ({ weekStart, minutes: minutes(seconds) })),
    topicMinutes: [...byTopic.values()].sort((a, b) => b.seconds - a.seconds).slice(0, 10).map(item => ({ topicId: item.topicId, topicName: item.topicName, minutes: minutes(item.seconds) })),
    practiceAccuracy: [...practice.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, item]) => ({ date, correct: item.correct, total: item.total, pct: Math.round((item.correct / item.total) * 100) })),
    neglectedTopics,
  }
}
