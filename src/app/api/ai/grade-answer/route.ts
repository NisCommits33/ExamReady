import { NextResponse } from 'next/server'
import { groqJSON } from '@/lib/groq'

export async function POST(req: Request) {
  const { topicName, questionType, userAnswer, modelAnswer } = await req.json()

  const marks = questionType === '5mark' ? 5 : 10

  const system = `You are a CAAN exam grader for Nepal's Aviation Fire Services Level 5 exam.

Grade this Paper 2 written answer as an official examiner. Be specific about which points earn marks.
Reference Nepal civil aviation context. Score out of ${marks}.

Return JSON:
{
  "score": <number 0-${marks}>,
  "feedback": "detailed paragraph",
  "strong": ["point that earned marks", ...],
  "missing": ["concept not covered", ...]
}`

  try {
    const data = await groqJSON<{ score: number; feedback: string; strong: string[]; missing: string[] }>([
      { role: 'system', content: system },
      {
        role: 'user',
        content: `Topic: ${topicName}\nQuestion type: ${marks}-mark answer\n${modelAnswer ? `Model hints: ${modelAnswer}\n` : ''}Student answer:\n${userAnswer}`,
      },
    ])
    return NextResponse.json(data)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 })
  }
}
