import { NextResponse } from 'next/server'
import { quotaGuard } from '@/lib/usage'
import { groqJSON } from '@/lib/groq'
import { createClient } from '@/lib/supabase/server'
import { logActivity } from '@/lib/activity'

export async function POST(req: Request) {
  const blocked = await quotaGuard(); if (blocked) return blocked
  const { topicId } = await req.json()
  if (!topicId) return NextResponse.json({ error: 'Missing topicId' }, { status: 400 })

  const supabase = await createClient()
  const [{ data: topic }, { data: note }] = await Promise.all([
    supabase.from('topics').select('name,exam_id').eq('id', topicId).single(),
    supabase.from('topic_notes').select('study_note,key_points,official_source,official_source_2').eq('topic_id', topicId).maybeSingle(),
  ])

  const source = [
    note?.key_points,
    note?.study_note,
    note?.official_source_2?.slice(0, 4000),
    note?.official_source?.slice(0, 4000),
  ].filter(Boolean).join('\n\n')
  if (!source) return NextResponse.json({ error: 'No study material to extract from' }, { status: 400 })

  const system = `You extract exam-critical NUMBERS, DATES, and THRESHOLDS from study material for a competitive exam.

Return JSON: { "numbers": [ { "fact": "what it describes", "value": "the number/date/threshold" }, ... ] }

Rules:
- "value" must be a concrete number, date, year, quantity, percentage, time limit, or threshold (e.g. "2053 BS", "40/50", "9 km/h", "Category 7", "2 minutes").
- "fact" is a short cue a student would recall it from (e.g. "CAAN Authority Act enacted", "Pass mark", "Response time requirement").
- Only include genuinely memorizable, exam-relevant figures. Skip vague or trivial numbers.
- Aim for 5-15 of the most important figures.`

  try {
    const data = await groqJSON<{ numbers: { fact: string; value: string }[] }>([
      { role: 'system', content: system },
      { role: 'user', content: `Topic: ${topic?.name ?? ''}\n\nMaterial:\n${source}` },
    ], { action: 'extract_numbers' })

    const numbers = (data.numbers ?? []).filter(n => n.fact && n.value)

    // Replace existing numbers for this topic
    await supabase.from('key_numbers').delete().eq('topic_id', topicId)
    if (numbers.length) {
      await supabase.from('key_numbers').insert(
        numbers.map(n => ({ topic_id: topicId, exam_id: topic?.exam_id ?? null, fact: n.fact, value: n.value }))
      )
    }

    logActivity('extract_numbers', topicId, { count: numbers.length })
    return NextResponse.json({ count: numbers.length, numbers })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 })
  }
}
