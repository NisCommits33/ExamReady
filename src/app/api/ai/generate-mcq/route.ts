import { NextResponse } from 'next/server'
import { groqJSON } from '@/lib/groq'
import { logActivity } from '@/lib/activity'
import { getExamPromptContext } from '@/lib/exam'

export async function POST(req: Request) {
  const { topicName, subsections, difficulty, topicId } = await req.json()
  const examCtx = await getExamPromptContext()

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
    const data = await groqJSON<{ questions: unknown[] }>([
      { role: 'system', content: system },
      {
        role: 'user',
        content: `Generate 5 MCQs for: "${topicName}"\nSubsections: ${subsections.join(', ')}\nDifficulty: ${difficulty}`,
      },
    ])
    logActivity('generate_mcq', topicId ?? null, { topic: topicName, difficulty, count: data.questions?.length })
    return NextResponse.json(data)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 })
  }
}
