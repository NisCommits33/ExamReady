import Groq from 'groq-sdk'
import { recordUsage, type UsageCtx } from '@/lib/usage'
import { GROQ_MODEL_SMART, GROQ_MODEL_FAST } from '@/lib/constants'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

// Smart model — streaming study notes (quality). Fast model — structured JSON (cheaper/faster).
const MODEL_SMART = GROQ_MODEL_SMART
const MODEL_FAST = GROQ_MODEL_FAST

type Message = { role: 'system' | 'user' | 'assistant'; content: string }

type GroqUsage = { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } | null | undefined

function track(model: string, usage: GroqUsage, ctx?: UsageCtx) {
  if (!ctx || !usage) return
  ctx.tokens = usage.total_tokens ?? 0
  void recordUsage('groq', model, ctx.action, {
    prompt: usage.prompt_tokens ?? 0,
    completion: usage.completion_tokens ?? 0,
    total: usage.total_tokens ?? 0,
  })
}

/**
 * Streaming: returns a ReadableStream of SSE chunks compatible with
 * text/event-stream responses (passthrough from Groq → browser).
 */
export async function groqStream(messages: Message[], usageCtx?: UsageCtx): Promise<ReadableStream<Uint8Array>> {
  const stream = await groq.chat.completions.create({
    model: MODEL_SMART,
    messages,
    stream: true,
    temperature: 0.3,
    max_tokens: 2048,
    // stream_options isn't in the SDK types but Groq honours it (OpenAI-compatible).
    ...({ stream_options: { include_usage: true } } as object),
  })

  const encoder = new TextEncoder()

  return new ReadableStream({
    async start(controller) {
      let usage: GroqUsage
      for await (const chunk of stream) {
        const chunkUsage = (chunk as { usage?: GroqUsage }).usage
        if (chunkUsage) usage = chunkUsage
        const delta = chunk.choices[0]?.delta?.content ?? ''
        if (delta) {
          // Re-emit as SSE so the client-side reader works the same way
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: delta } }] })}\n\n`))
        }
      }
      track(MODEL_SMART, usage, usageCtx)
      // Final event so the client can show tokens used for this task.
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ tokens: usage?.total_tokens ?? 0 })}\n\n`))
      controller.enqueue(encoder.encode('data: [DONE]\n\n'))
      controller.close()
    },
  })
}

/**
 * Plain-text completion — returns the full response as a string (non-streaming).
 */
export async function groqText(messages: Message[], maxTokens = 4096, usageCtx?: UsageCtx, model: string = MODEL_SMART): Promise<string> {
  const res = await groq.chat.completions.create({
    model,
    messages,
    temperature: 0.4,
    max_tokens: maxTokens,
  })
  track(model, res.usage, usageCtx)
  return res.choices[0]?.message?.content ?? ''
}

/**
 * JSON: parses the model response as T. Uses response_format json_object.
 * Defaults to the fast model (structured, high-volume); override via `opts.model`.
 */
export async function groqJSON<T>(messages: Message[], usageCtx?: UsageCtx, opts?: { temperature?: number; maxTokens?: number; model?: string }): Promise<T> {
  const model = opts?.model ?? MODEL_FAST
  const res = await groq.chat.completions.create({
    model,
    messages,
    temperature: opts?.temperature ?? 0.2,
    max_tokens: opts?.maxTokens ?? 4096,
    response_format: { type: 'json_object' },
  })

  track(model, res.usage, usageCtx)
  const content = res.choices[0]?.message?.content
  if (!content) throw new Error('Empty response from Groq')
  return JSON.parse(content) as T
}
