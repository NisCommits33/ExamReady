import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { groqJSON } from '@/lib/groq'
import { daysToExam } from '@/lib/utils'
import { addDays, format } from 'date-fns'

export async function POST() {
  try {
    const supabase = await createServiceClient()
    const today = new Date()
    const todayStr = format(today, 'yyyy-MM-dd')
    const futureStr = format(addDays(today, 7), 'yyyy-MM-dd')

    const [{ data: topics }, { data: sessions }, { data: shifts }] = await Promise.all([
      supabase.from('topics').select('id,name,paper,status,ai_priority,last_studied').order('ai_priority', { ascending: false }),
      supabase.from('sessions').select('topic_id,date,duration_mins').gte('date', format(addDays(today, -14), 'yyyy-MM-dd')),
      supabase.from('shifts').select('date,type,study_start,study_end').gte('date', todayStr).lte('date', futureStr),
    ])

    const daysLeft = daysToExam()
    const pendingTopics = (topics ?? []).filter(t => t.status !== 'done').slice(0, 20)

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
        content: `You are an exam study planner for the Nepal CAAN Level 5 exam.

Rules:
- not_started topics get 2× weight over in_progress; done topics = 0
- IQ practice must appear at least 3× per week (topic_id: null, session_type: "iq")
- A-shift: 4 hours 13:00–17:00 | B-shift: 4 hours 07:00–11:00
- Session durations: study=60min, drill=45min, review=45min, iq=45min
- Prioritize highest ai_priority topics first

Return JSON: { "sessions": [{ "topic_id": "uuid or null", "scheduled_date": "YYYY-MM-DD", "shift_type": "A|B", "slot_time": "HH:MM", "duration_mins": 60, "session_type": "study|drill|review|iq" }] }`,
      },
      {
        role: 'user',
        content: JSON.stringify({ daysRemaining: daysLeft, topics: pendingTopics, recentSessions: sessions ?? [], shifts: shifts ?? [] }),
      },
    ])

    await supabase.from('planned_sessions').delete().gte('scheduled_date', todayStr).eq('completed', false)

    if (data.sessions?.length) {
      await supabase.from('planned_sessions').insert(
        data.sessions.map(s => ({ ...s, ai_generated: true, completed: false }))
      )
    }

    return NextResponse.json({ ok: true, count: data.sessions?.length ?? 0 })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
