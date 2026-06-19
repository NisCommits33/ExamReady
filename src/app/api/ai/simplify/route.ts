import { NextResponse } from 'next/server'
import { groqStream } from '@/lib/groq'
import { createClient } from '@/lib/supabase/server'
import { logActivity } from '@/lib/activity'
import { hashContent, getCachedTransform, saveTransform } from '@/lib/ai-cache'

const SSE_HEADERS = { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' }

/** Emit a full string as a single SSE chunk + [DONE], matching the groqStream wire format. */
function sseFromText(text: string): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  return new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}\n\n`))
      controller.enqueue(encoder.encode('data: [DONE]\n\n'))
      controller.close()
    },
  })
}

/** Pass SSE chunks through to the client while accumulating the text, then persist it once complete. */
function passThroughAndStore(src: ReadableStream<Uint8Array>, onDone: (full: string) => Promise<void>): ReadableStream<Uint8Array> {
  const reader = src.getReader()
  const decoder = new TextDecoder()
  let full = ''
  return new ReadableStream({
    async start(controller) {
      for (;;) {
        const { done, value } = await reader.read()
        if (done) { await onDone(full); controller.close(); return }
        controller.enqueue(value)
        for (const line of decoder.decode(value).split('\n')) {
          if (line.startsWith('data: ')) {
            const d = line.slice(6)
            if (d === '[DONE]') continue
            try { full += JSON.parse(d).choices?.[0]?.delta?.content ?? '' } catch {}
          }
        }
      }
    },
  })
}

export async function POST(req: Request) {
  const { text, topicName } = await req.json()
  if (!text) return NextResponse.json({ error: 'Missing text' }, { status: 400 })

  const supabase = await createClient()
  const hash = hashContent(String(text))

  // Serve a stored result instantly if the source text is unchanged.
  const cached = await getCachedTransform(supabase, hash, 'simplify')
  if (cached) {
    logActivity('simplify', null, { topic: topicName, cached: true })
    return new Response(sseFromText(cached.output), { headers: SSE_HEADERS })
  }

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

    const wrapped = passThroughAndStore(stream, async (full) => {
      if (full.trim()) await saveTransform(supabase, hash, 'simplify', full, { topicName })
    })

    return new Response(wrapped, { headers: SSE_HEADERS })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 })
  }
}
