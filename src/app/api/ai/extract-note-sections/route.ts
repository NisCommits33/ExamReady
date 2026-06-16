import { NextResponse } from 'next/server'
import { groqJSON } from '@/lib/groq'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: Request) {
  const { topicId, studyNote } = await req.json()
  if (!topicId || !studyNote) {
    return NextResponse.json({ error: 'Missing topicId or studyNote' }, { status: 400 })
  }

  try {
    const data = await groqJSON<{ key_points: string; exam_tips: string }>([
      {
        role: 'system',
        content: `You extract and reformat two specific sections from a study note into clean markdown.

Return JSON with exactly two fields:

"key_points": A focused bullet-list reference card. Include:
- All critical numbers, thresholds, time limits, quantities (one line each)
- Important dates and act/regulation years
- Key definitions in one sentence
- Any minimum/maximum values from standards
Format as grouped markdown with ## headers (e.g. ## Critical Numbers, ## Key Terms, ## Timelines).

"exam_tips": Practical exam guidance. Include:
- 3-5 common MCQ traps and how to avoid them
- Confusing similar terms that get mixed up
- How to structure a 5-mark answer (3-4 bullet points)
- How to structure a 10-mark answer (5-6 bullet points)
- One "must memorise" sentence for this topic
Format as grouped markdown with ## headers (e.g. ## MCQ Traps, ## Paper 2 Strategy, ## Must Memorise).

Be concise. No waffle. Every line must be exam-useful.`,
      },
      {
        role: 'user',
        content: `Extract key_points and exam_tips from this study note:\n\n${studyNote.slice(0, 4000)}`,
      },
    ])

    const supabase = await createClient()
    await supabase.from('topic_notes').update({
      key_points: data.key_points,
      exam_tips: data.exam_tips,
      updated_at: new Date().toISOString(),
    }).eq('topic_id', topicId)

    return NextResponse.json({ key_points: data.key_points, exam_tips: data.exam_tips })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 })
  }
}
