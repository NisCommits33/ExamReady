import { NextResponse } from 'next/server'
import { quotaGuard } from '@/lib/usage'
import { createClient } from '@/lib/supabase/server'
import { groqJSON } from '@/lib/groq'
import { logActivity } from '@/lib/activity'
import { daysToExam } from '@/lib/utils'
import { addDays, format } from 'date-fns'

export async function POST() {
  const blocked = await quotaGuard(); if (blocked) return blocked
  try {
    const supabase = await createClient()
    const today = new Date()
    const todayStr = format(today, 'yyyy-MM-dd')
    const futureStr = format(addDays(today, 7), 'yyyy-MM-dd')

    const [{ data: rawTopics }, { data: sessions }, { data: shifts }, { data: dueCards }] = await Promise.all([
      supabase.from('topics').select('id,name,paper,ai_priority,user_topic_progress(status,last_studied)'),
      supabase.from('sessions').select('topic_id,date,duration_mins').gte('date', format(addDays(today, -14), 'yyyy-MM-dd')),
      supabase.from('shifts').select('date,type,study_start,study_end,shift_types(study_start,study_end)').gte('date', todayStr).lte('date', futureStr),
      supabase.from('flashcard_reviews').select('topic_id').lte('due_date', todayStr),
    ])

    // How many spaced-repetition cards are due per topic — a strong "needs review now" signal.
    const dueByTopic = new Map<string, number>()
    for (const c of dueCards ?? []) {
      if (c.topic_id) dueByTopic.set(c.topic_id, (dueByTopic.get(c.topic_id) ?? 0) + 1)
    }

    const topics = (rawTopics ?? []).map(t => {
      const raw = (t as { user_topic_progress?: unknown }).user_topic_progress
      const p = (Array.isArray(raw) ? raw[0] : raw) as { status?: string; last_studied?: string } | null
      return { id: t.id, name: t.name, paper: t.paper, ai_priority: t.ai_priority, status: p?.status ?? 'not_started', last_studied: p?.last_studied ?? null, due_reviews: dueByTopic.get(t.id) ?? 0 }
    }).sort((a, b) => (b.due_reviews - a.due_reviews) || ((b.ai_priority ?? 0) - (a.ai_priority ?? 0)))

    const flatShifts = (shifts ?? []).map(s => {
      const raw = s.shift_types as unknown
      const st = (Array.isArray(raw) ? raw[0] : raw) as { study_start: string; study_end: string } | null
      const row = s as { study_start?: string | null; study_end?: string | null }
      return { date: s.date, type: s.type, study_start: row.study_start ?? st?.study_start, study_end: row.study_end ?? st?.study_end }
    })

    const daysLeft = daysToExam()
    // Keep unfinished topics, plus any "done" topic that has due review cards to refresh.
    const pendingTopics = topics.filter(t => t.status !== 'done' || t.due_reviews > 0).slice(0, 20)

    const data = await groqJSON<{
      sessions: {
        topic_id: string | null
        scheduled_date: string
        shift_type: string
        slot_time: string
        duration_mins: number
        session_type: string
      }[]
    }>([
      {
        role: 'system',
        content: `You are an exam study planner for a competitive exam.

Rules:
- Topics with more "due_reviews" (overdue spaced-repetition cards) are the highest priority — schedule a "review" session for them first, even if marked done. Spaced repetition beats re-reading.
- not_started topics get 2× weight over in_progress; done topics with due_reviews still need a review session
- IQ practice must appear at least 3× per week (topic_id: null, session_type: "iq")
- A-shift: 4 hours 13:00–17:00 | B-shift: 4 hours 07:00–11:00
- Session durations: study=60min, drill=45min, review=45min, iq=45min
- Prioritize highest ai_priority topics first

Return JSON: { "sessions": [{ "topic_id": "uuid or null", "scheduled_date": "YYYY-MM-DD", "shift_type": "A|B", "slot_time": "HH:MM", "duration_mins": 60, "session_type": "study|drill|review|iq" }] }`,
      },
      {
        role: 'user',
        content: JSON.stringify({ daysRemaining: daysLeft, topics: pendingTopics, recentSessions: sessions ?? [], shifts: flatShifts }),
      },
    ], { action: 'replan_schedule' })

    // Never wipe the existing plan on an empty/invalid AI response — that would destroy the user's schedule.
    if (!Array.isArray(data.sessions) || data.sessions.length === 0) {
      return NextResponse.json({ error: 'Planner returned no sessions; existing schedule kept' }, { status: 502 })
    }

    // Capture the old future-incomplete sessions BEFORE writing, insert the new plan, and only then
    // delete exactly those old rows. A failed insert leaves the existing schedule untouched.
    const { data: oldRows } = await supabase.from('planned_sessions')
      .select('id').gte('scheduled_date', todayStr).eq('completed', false)
    const oldIds = (oldRows ?? []).map(r => r.id)

    const { error: insertErr } = await supabase.from('planned_sessions').insert(
      data.sessions.map(s => ({ ...s, ai_generated: true, completed: false }))
    )
    if (insertErr) {
      return NextResponse.json({ error: `Failed to save plan: ${insertErr.message}` }, { status: 500 })
    }
    if (oldIds.length) {
      await supabase.from('planned_sessions').delete().in('id', oldIds)
    }

    logActivity('replan_schedule', null, { sessionCount: data.sessions.length })
    return NextResponse.json({ ok: true, count: data.sessions.length })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
