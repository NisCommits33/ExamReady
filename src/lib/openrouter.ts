import { recordUsage, type UsageCtx } from '@/lib/usage'

const ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions'
const EMBED_ENDPOINT = 'https://openrouter.ai/api/v1/embeddings'

// Default free model — override with OPENROUTER_MODEL in env.
export const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || 'cohere/north-mini-code:free'
// Embedding model — must output 768 dims to match content_chunks. Default is
// openai/text-embedding-3-small: multilingual (handles Nepali source docs), 8191-token
// context (long chunks), and Matryoshka `dimensions:768`. ~$0.02/1M tokens.
// Override with OPENROUTER_EMBED_MODEL; set OPENROUTER_EMBED_DIMS='' to omit the dimensions
// param for native-768 models (e.g. baai/bge-base-en-v1.5 — but note its 512-token limit).
export const OPENROUTER_EMBED_MODEL = process.env.OPENROUTER_EMBED_MODEL || 'openai/text-embedding-3-small'
const EMBED_DIMS = 768
const EMBED_DIMS_PARAM = process.env.OPENROUTER_EMBED_DIMS === '' ? undefined
  : process.env.OPENROUTER_EMBED_DIMS ? Number(process.env.OPENROUTER_EMBED_DIMS) : EMBED_DIMS

type Message = { role: 'system' | 'user' | 'assistant'; content: string }

function orHeaders(): Record<string, string> {
  return {
    Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
    'Content-Type': 'application/json',
    'HTTP-Referer': process.env.NEXT_PUBLIC_SITE_URL || 'https://lokai.app',
    'X-Title': 'LOKAI',
  }
}

/**
 * Embed texts via OpenRouter's OpenAI-compatible /embeddings endpoint (768 dims).
 * Batches ≤96 inputs/request and records token usage. Replaces the Gemini embedder.
 */
export async function openrouterEmbed(texts: string[], usageCtx?: UsageCtx): Promise<number[][]> {
  if (texts.length === 0) return []
  if (!process.env.OPENROUTER_API_KEY) throw new Error('OPENROUTER_API_KEY is not set')

  const model = OPENROUTER_EMBED_MODEL
  const BATCH = 96
  const out: number[][] = []
  let totalTokens = 0

  for (let i = 0; i < texts.length; i += BATCH) {
    const input = texts.slice(i, i + BATCH)
    const res = await fetch(EMBED_ENDPOINT, {
      method: 'POST',
      headers: orHeaders(),
      body: JSON.stringify({ model, input, ...(EMBED_DIMS_PARAM ? { dimensions: EMBED_DIMS_PARAM } : {}) }),
    })
    if (!res.ok) throw new Error(`OpenRouter embeddings ${res.status}: ${(await res.text()).slice(0, 300)}`)
    const json = await res.json()
    const data = (json.data ?? []) as { embedding: number[]; index: number }[]
    if (data.length !== input.length) throw new Error(`Embedding count mismatch: got ${data.length}, expected ${input.length}`)
    for (const d of [...data].sort((a, b) => a.index - b.index)) {
      if (d.embedding.length !== EMBED_DIMS) {
        throw new Error(`Embedding model returned ${d.embedding.length} dims, expected ${EMBED_DIMS}. Set OPENROUTER_EMBED_MODEL to a ${EMBED_DIMS}-dim model (or one that honours the dimensions param).`)
      }
      out.push(d.embedding)
    }
    totalTokens += json.usage?.total_tokens ?? Math.ceil(input.reduce((n, t) => n + t.length, 0) / 4)
  }

  if (usageCtx) {
    usageCtx.tokens = totalTokens
    void recordUsage('openrouter', model, usageCtx.action, { prompt: totalTokens, completion: 0, total: totalTokens })
  }
  return out
}

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
