import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { geminiText } from '@/lib/gemini'
import { groqJSON } from '@/lib/groq'
import { daysToExam } from '@/lib/utils'
import { addDays, format } from 'date-fns'

export async function POST(req: Request) {
  const { topicId } = await req.json()

  try {
    const supabase = await createServiceClient()
    const daysLeft = daysToExam()

    const [{ data: topic }, { data: sessions }, { data: shifts }] = await Promise.all([
      supabase.from('topics').select('*').eq('id', topicId).single(),
      supabase.from('sessions').select('date,duration_mins').eq('topic_id', topicId),
      supabase
        .from('shifts')
        .select('date,type,study_start,study_end')
        .gte('date', format(new Date(), 'yyyy-MM-dd'))
        .lte('date', format(addDays(new Date(), 5), 'yyyy-MM-dd')),
    ])

    if (!topic) return NextResponse.json({ error: 'Topic not found' }, { status: 404 })

    // Gemini handles multi-step reasoning for the rescue note
    const rescueNote = await geminiText(
      `You are an emergency study coach for the Nepal CAAN Level 5 exam (Aviation Fire Services).
Create a focused rescue note for a topic with only ${daysLeft} days remaining.
Be concise, exam-focused, and include specific numbers/thresholds.`,
      `Topic: ${topic.name}
Paper ${topic.paper}, Section ${topic.section}
Subsections: ${topic.subsections.join(', ')}
Sessions completed: ${sessions?.length ?? 0}
Days remaining: ${daysLeft}

Write a 300-word focused rescue note covering ONLY the most exam-critical facts.
Format: numbered key points, include one important number/date/threshold per point where applicable.
End with 3 "MUST MEMORIZE" items in bold.`,
      1024,
      true // use thinking model
    )

    // Groq handles the fast MCQ generation
    const mcqs = await groqJSON<{ questions: unknown[] }>([
      {
        role: 'system',
        content: `Generate targeted MCQs for CAAN exam rescue drilling. Focus on the most common exam mistakes and high-probability questions. Return JSON: {"questions": [{"question": "...", "options": {"A":"...","B":"...","C":"...","D":"..."}, "correct": "A", "explanation": "...", "trap": "..."}]}`,
      },
      {
        role: 'user',
        content: `Generate 10 MCQs for: "${topic.name}". Target common mistakes, include exact figures and thresholds.`,
      },
    ])

    const rescueSessions = (shifts ?? []).slice(0, 3).map((shift, i) => ({
      topic_id: topicId,
      scheduled_date: shift.date,
      shift_type: shift.type,
      slot_time: shift.study_start,
      duration_mins: 60,
      session_type: i === 0 ? 'study' : i === 1 ? 'drill' : 'review',
      ai_generated: true,
      completed: false,
    }))

    await Promise.all([
      supabase.from('ai_notes').insert({ topic_id: topicId, content: rescueNote }),
      supabase.from('topics').update({ is_flagged: true }).eq('id', topicId),
      rescueSessions.length
        ? supabase.from('planned_sessions').insert(rescueSessions)
        : Promise.resolve(),
    ])

    return NextResponse.json({ ok: true, note: rescueNote, mcqCount: mcqs.questions?.length ?? 0 })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
