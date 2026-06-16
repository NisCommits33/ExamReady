import { NextResponse } from 'next/server'
import { groqJSON } from '@/lib/groq'

export async function POST(req: Request) {
  const { topicName, subsections, marks } = await req.json()
  if (!topicName || !marks) {
    return NextResponse.json({ error: 'Missing topicName or marks' }, { status: 400 })
  }

  const markCount = marks === '5mark' ? 5 : 10

  try {
    const data = await groqJSON<{ question: string; hints: string[] }>([
      {
        role: 'system',
        content: `You are a CAAN Level 5 exam paper setter for Aviation Fire Services (ARFF).

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
Make the question specific to the topic, not generic. Reference ARFF/airport operations context.`,
      },
      {
        role: 'user',
        content: `Topic: ${topicName}\nSubsections: ${(subsections ?? []).join(', ')}\nMarks: ${markCount}`,
      },
    ])

    return NextResponse.json({ question: data.question, hints: data.hints, marks: markCount })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 })
  }
}
