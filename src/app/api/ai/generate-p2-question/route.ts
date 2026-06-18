import { NextResponse } from 'next/server'
import { groqJSON } from '@/lib/groq'
import { createClient } from '@/lib/supabase/server'
import { logActivity } from '@/lib/activity'
import { getExamPromptContext } from '@/lib/exam'

export async function POST(req: Request) {
  const { topicName, subsections, marks, topicId } = await req.json()
  if (!topicName || !marks) {
    return NextResponse.json({ error: 'Missing topicName or marks' }, { status: 400 })
  }
  const examCtx = await getExamPromptContext()

  const markCount = marks === '5mark' ? 5 : 10

  let previousQuestions: string[] = []
  if (topicId) {
    try {
      const supabase = await createClient()
      const { data } = await supabase
        .from('p2_answers')
        .select('question_text')
        .eq('topic_id', topicId)
        .not('question_text', 'is', null)
        .order('attempted_at', { ascending: false })
        .limit(10)
      previousQuestions = (data ?? []).map(r => r.question_text).filter(Boolean) as string[]
    } catch {}
  }

  const avoidBlock = previousQuestions.length > 0
    ? `\n\nIMPORTANT: The student has already been asked these questions — do NOT repeat or rephrase any of them. Generate a completely different question covering a different aspect of the topic:\n${previousQuestions.map((q, i) => `${i + 1}. ${q}`).join('\n')}`
    : ''

  try {
    const data = await groqJSON<{ question: string; hints: string[] }>([
      {
        role: 'system',
        content: `You are a paper setter for the ${examCtx} exam.

Write a single descriptive exam question worth ${markCount} marks.

Style rules — match these real exam question formats exactly:
${markCount === 5 ? `
- "What are the [types/duties/procedures] of [topic]? State."
- "What do you know about [concept]?"
- "Define [term] and explain [application]."
- "What is [concept]? Write its [types/causes/methods]."
- "Why is [concept] important in fire service?"
- "In what condition [scenario]? Explain."
` : `
- "What is [major concept]? Discuss in detail."
- "What are the [roles/responsibilities] of [position] in case of [scenario]? Explain."
- "How does [equipment/system] work? Explain in detail."
- "Discuss the [procedure/principle] and explain how it applies at airports."
`}

Return JSON:
{
  "question": "The full question text ending with (${markCount} marks)",
  "hints": ["hint 1 — key point to cover", "hint 2", "hint 3"]
}

The hints are NOT shown during writing — they are used for AI grading guidance only.
Make the question specific to the topic, not generic. Ground it in this exam's real-world field.${avoidBlock}`,
      },
      {
        role: 'user',
        content: `Topic: ${topicName}\nSubsections: ${(subsections ?? []).join(', ')}\nMarks: ${markCount}`,
      },
    ])

    logActivity('generate_p2_question', topicId, { marks: markCount, question: data.question })
    return NextResponse.json({ question: data.question, hints: data.hints, marks: markCount })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 })
  }
}
