import { NextResponse } from 'next/server'
import { groqJSON } from '@/lib/groq'
import { createClient } from '@/lib/supabase/server'
import { logActivity } from '@/lib/activity'
import { getExamPromptContext } from '@/lib/exam'
import { getTopicSource, sourceGroundingBlock } from '@/lib/source'

export async function POST(req: Request) {
  const { topicName, subsections, difficulty, topicId } = await req.json()
  const examCtx = await getExamPromptContext()

  const supabase = await createClient()
  const source = topicId ? await getTopicSource(supabase, topicId) : null

  const system = `You are an MCQ writer for the ${examCtx} exam.

Rules:
- 4 options (A/B/C/D), exactly one correct
- Correct answer should NOT always be the longest option
- Include at least 1 question on numbers/dates/thresholds
- Mix difficulty levels
- Include traps: common misconceptions, similar-sounding terms
- Base questions on the topic's subject area and this exam's context

Return JSON:
{
  "questions": [
    {
      "question": "...",
      "options": {"A": "...", "B": "...", "C": "...", "D": "..."},
      "correct": "A",
      "explanation": "...",
      "trap": "why wrong options are tempting"
    }
  ]
}`

  try {
    const baseUserContent = `Generate 5 MCQs for: "${topicName}"\nSubsections: ${subsections.join(', ')}\nDifficulty: ${difficulty}`
    const data = await groqJSON<{ questions: unknown[] }>([
      { role: 'system', content: system },
      {
        role: 'user',
        content: source ? `${baseUserContent}\n\n${sourceGroundingBlock(source)}` : baseUserContent,
      },
    ])
    logActivity('generate_mcq', topicId ?? null, { topic: topicName, difficulty, count: data.questions?.length })
    return NextResponse.json(data)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 })
  }
}
