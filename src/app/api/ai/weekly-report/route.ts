import { NextResponse } from 'next/server'
import { quotaGuard } from '@/lib/usage'
import { createClient } from '@/lib/supabase/server'
import { groqJSON } from '@/lib/groq'
import { logActivity } from '@/lib/activity'
import { format, startOfWeek, subDays } from 'date-fns'
import { daysToExam } from '@/lib/utils'

export async function POST() {
  const blocked = await quotaGuard(); if (blocked) return blocked
  try {
    const supabase = await createClient()
    const today = new Date()
    const weekStart = format(startOfWeek(today, { weekStartsOn: 1 }), 'yyyy-MM-dd')
    const weekAgo = format(subDays(today, 7), 'yyyy-MM-dd')

    const [{ data: sessions }, { data: rawTopics }] = await Promise.all([
      supabase.from('sessions').select('duration_mins,date,topics(name,paper)').gte('date', weekAgo),
      supabase.from('topics').select('name,paper,ai_priority,user_topic_progress(status,mcq_best_score)'),
    ])

    const topics = (rawTopics ?? []).map(t => {
      const raw = (t as { user_topic_progress?: unknown }).user_topic_progress
      const p = (Array.isArray(raw) ? raw[0] : raw) as { status?: string; mcq_best_score?: number } | null
      return { name: t.name, paper: t.paper, ai_priority: t.ai_priority, status: p?.status ?? 'not_started', mcq_best_score: p?.mcq_best_score ?? null }
    })

    const daysLeft = daysToExam()
    const notStarted = topics.filter(t => t.status === 'not_started')
    const done = topics.filter(t => t.status === 'done')
    const highRisk = notStarted.filter(t => (t.ai_priority ?? 5) >= 7).map(t => t.name)

    const data = await groqJSON<{ report: string; risk_topics: string[] }>([
      {
        role: 'system',
        content: `You are a brutally honest exam readiness coach for a competitive exam.
Write a 5-line weekly report. Be direct, specific, no fluff.
Return JSON: { "report": "line1\nline2\nline3\nline4\nline5", "risk_topics": ["topic name", ...] }`,
      },
      {
        role: 'user',
        content: `Days to exam: ${daysLeft}
Sessions this week: ${sessions?.length ?? 0}
Topics done: ${done.length}/38 | Not started: ${notStarted.length}
High-priority not started: ${highRisk.join(', ') || 'none'}
Recent sessions: ${JSON.stringify((sessions ?? []).slice(0, 8))}

Write 5 lines: 1) What improved 2) What stalled 3) Biggest risk 4) One specific fix 5) Projected readiness on current trajectory`,
      },
    ], { action: 'weekly_report' })

    const { data: saved } = await supabase
      .from('weekly_reports')
      .upsert(
        { week_start: weekStart, content: data.report, risk_topics: data.risk_topics, generated_at: new Date().toISOString() },
        { onConflict: 'user_id,week_start' }
      )
      .select()
      .single()

    logActivity('weekly_report', null, { riskTopics: data.risk_topics?.length })
    return NextResponse.json({ ok: true, report: saved })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
