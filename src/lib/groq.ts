import Groq from 'groq-sdk'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

// Default model — fast + smart
const MODEL = 'llama-3.3-70b-versatile'

type Message = { role: 'system' | 'user' | 'assistant'; content: string }

/**
 * Streaming: returns a ReadableStream of SSE chunks compatible with
 * text/event-stream responses (passthrough from Groq → browser).
 */
export async function groqStream(messages: Message[]): Promise<ReadableStream<Uint8Array>> {
  const stream = await groq.chat.completions.create({
    model: MODEL,
    messages,
    stream: true,
    temperature: 0.3,
    max_tokens: 2048,
  })

  const encoder = new TextEncoder()

  return new ReadableStream({
    async start(controller) {
      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content ?? ''
        if (delta) {
          // Re-emit as SSE so the client-side reader works the same way
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: delta } }] })}\n\n`))
        }
      }
      controller.enqueue(encoder.encode('data: [DONE]\n\n'))
      controller.close()
    },
  })
}

/**
 * Plain-text completion — returns the full response as a string (non-streaming).
 */
export async function groqText(messages: Message[], maxTokens = 4096): Promise<string> {
  const res = await groq.chat.completions.create({
    model: MODEL,
    messages,
    temperature: 0.4,
    max_tokens: maxTokens,
  })
  return res.choices[0]?.message?.content ?? ''
}

/**
 * JSON: parses the model response as T. Uses response_format json_object
 * where supported, otherwise parses the raw text.
 */
export async function groqJSON<T>(messages: Message[]): Promise<T> {
  const res = await groq.chat.completions.create({
    model: MODEL,
    messages,
    temperature: 0.2,
    max_tokens: 4096,
    response_format: { type: 'json_object' },
  })

  const content = res.choices[0]?.message?.content
  if (!content) throw new Error('Empty response from Groq')
  return JSON.parse(content) as T
}
