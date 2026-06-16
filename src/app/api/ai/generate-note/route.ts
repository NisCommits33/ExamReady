import { NextResponse } from 'next/server'
import { groqStream } from '@/lib/groq'

export async function POST(req: Request) {
  const { topicId, topicName, paper, section, subsections } = await req.json()

  const systemPrompt = `You are an expert study note writer for the Nepal CAAN Level 5 Senior Assistant exam (Aviation Fire Services Group).

Generate a comprehensive study note. Structure it as follows:

1. DEFINITION: A clear 2-3 sentence definition
2. CORE CONTENT: Cover all subsections with headers. Use plain language. Include relevant numbers, dates, thresholds.
3. ARFF CONTEXT: Ground at least 2 examples in practical ARFF firefighting scenarios and real airport operations
4. KEY NUMBERS & DATES: Bullet list of important figures, years, thresholds to memorize
5. EXAM TRAPS: 2-3 common MCQ traps and confusing terms for this topic
6. PAPER 2 HINT: How to structure a 5-mark and 10-mark answer on this topic
7. KEYWORDS: Comma-separated list of 6-10 key terms

Write in clear English. Be specific. Target length: 600-900 words.
For regulations and acts, include specific section numbers and provisions.`

  try {
    const stream = await groqStream([
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: `Generate study note for: ${topicName}\nPaper: ${paper}, Section: ${section}\nSubsections: ${subsections.join(', ')}`,
      },
    ])

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 })
  }
}
