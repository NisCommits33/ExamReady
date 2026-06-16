import { NextResponse } from 'next/server'
import { groqJSON } from '@/lib/groq'

export async function POST(req: Request) {
  const { topicName, subsections, difficulty } = await req.json()

  const system = `You are a CAAN exam MCQ writer for Nepal's Aviation Fire Services Level 5 exam.

Rules:
- 4 options (A/B/C/D), exactly one correct
- Correct answer should NOT always be the longest option
- Include at least 1 question on numbers/dates/thresholds
- Mix difficulty levels
- Include traps: common misconceptions, similar-sounding terms
- Base questions on ARFF, Nepal aviation context

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
    return NextResponse.json(data)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 })
  }
}
