import { NextResponse } from 'next/server'
import { groqJSON } from '@/lib/groq'
import { IQ_QUESTION_TYPES } from '@/lib/constants'

export async function POST(req: Request) {
  const { type, count, difficulty } = await req.json()

  const isRandom = type === 'random'
  const picked = isRandom
    ? IQ_QUESTION_TYPES[Math.floor(Math.random() * IQ_QUESTION_TYPES.length)]
    : IQ_QUESTION_TYPES.find(t => t.id === type)

  const system = `You are an IQ test question generator for the Nepal CAAN exam (Verbal Reasoning, Non-verbal Reasoning, Arithmetic).

For figure-based questions (figure series, mirror images, figure matrix), describe the pattern in clear text, e.g. "Shape rotates 90° clockwise each step."

Return JSON:
{
  "questions": [
    {
      "question_text": "...",
      "options": {"A": "...", "B": "...", "C": "...", "D": "..."},
      "correct_answer": "A",
      "explanation": "step-by-step reasoning",
      "difficulty": "easy|medium|hard"
    }
  ]
}`

  try {
    const data = await groqJSON<{ questions: unknown[] }>([
      { role: 'system', content: system },
      {
        role: 'user',
        content: `Generate ${count} ${picked?.label ?? 'mixed reasoning'} questions (category: ${picked?.category ?? 'verbal'}). Difficulty mix: ${difficulty}.`,
      },
    ])
    return NextResponse.json(data)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 })
  }
}
