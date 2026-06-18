import { NextResponse } from 'next/server'
import { groqStream } from '@/lib/groq'
import { logActivity } from '@/lib/activity'

export async function POST(req: Request) {
  const { text, topicName } = await req.json()
  if (!text) return NextResponse.json({ error: 'Missing text' }, { status: 400 })

  const system = `You are a study helper for a competitive exam. Rewrite dense source material (legal acts, regulations, technical docs) into plain, simple language a student can quickly read and remember.

Rules:
- Use short sentences and everyday words. Avoid legalese.
- Keep ALL exam-critical facts: numbers, dates, thresholds, section references, definitions.
- Use bullet points and bold for key terms.
- Preserve structure with short headers where helpful.
- Do not add information that isn't in the source.
- Aim for roughly half the length of the original.`

  try {
    const stream = await groqStream([
      { role: 'system', content: system },
      { role: 'user', content: `Topic: ${topicName ?? 'General'}\n\nSimplify this:\n\n${String(text).slice(0, 8000)}` },
    ])

    logActivity('simplify', null, { topic: topicName })

    return new Response(stream, {
      headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' },
    })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 })
  }
}
