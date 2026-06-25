import { recordUsage, type UsageCtx } from '@/lib/usage'

const ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions'

// Default free model — override with OPENROUTER_MODEL in env.
export const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || 'cohere/north-mini-code:free'

type Message = { role: 'system' | 'user' | 'assistant'; content: string }

/** Best-effort extraction of a JSON object from a model reply (handles code fences / stray prose). */
function extractJson(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fenced) return fenced[1].trim()
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  return start >= 0 && end > start ? text.slice(start, end + 1) : text.trim()
}

/**
 * JSON completion via OpenRouter (OpenAI-compatible). Records token usage when `usageCtx` is given.
 * Free models often don't honour response_format, so we instruct JSON in the prompt and parse robustly.
 */
export async function openrouterJSON<T>(
  messages: Message[],
  usageCtx?: UsageCtx,
  opts?: { model?: string; temperature?: number },
): Promise<T> {
  if (!process.env.OPENROUTER_API_KEY) throw new Error('OPENROUTER_API_KEY is not set')
  const model = opts?.model || OPENROUTER_MODEL

  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': process.env.NEXT_PUBLIC_SITE_URL || 'https://lokai.app',
      'X-Title': 'LOKAI',
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: opts?.temperature ?? 0.7,
      max_tokens: 8000,
      // Free "reasoning" models (e.g. Nemotron) otherwise dump everything into the
      // `reasoning` field and return empty `content`. Disabling it forces a real answer.
      reasoning: { enabled: false },
    }),
  })

  if (!res.ok) throw new Error(`OpenRouter ${res.status}: ${(await res.text()).slice(0, 300)}`)
  const json = await res.json()

  const usage = json.usage
  if (usageCtx && usage) {
    usageCtx.tokens = usage.total_tokens ?? 0
    void recordUsage('openrouter', model, usageCtx.action, {
      prompt: usage.prompt_tokens ?? 0,
      completion: usage.completion_tokens ?? 0,
      total: usage.total_tokens ?? 0,
    })
  }

  const message = json.choices?.[0]?.message ?? {}
  // Some reasoning models still leave `content` empty and put the JSON in `reasoning`.
  const content: string = message.content || message.reasoning || ''
  if (!content) throw new Error('Empty response from OpenRouter (model returned no content)')
  return JSON.parse(extractJson(content)) as T
}
