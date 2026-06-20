import { GoogleGenAI } from '@google/genai'
import { recordUsage, type UsageCtx } from '@/lib/usage'

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })

// Use Flash for speed, Pro for heavy reasoning
const MODEL_FAST   = 'gemini-2.0-flash'
const MODEL_REASON = 'gemini-2.0-flash-thinking-exp'

type GeminiUsage = { promptTokenCount?: number; candidatesTokenCount?: number; totalTokenCount?: number } | undefined

function track(model: string, usage: GeminiUsage, ctx?: UsageCtx) {
  if (!ctx || !usage) return
  ctx.tokens = usage.totalTokenCount ?? 0
  void recordUsage('gemini', model, ctx.action, {
    prompt: usage.promptTokenCount ?? 0,
    completion: usage.candidatesTokenCount ?? 0,
    total: usage.totalTokenCount ?? 0,
  })
}

/**
 * Single-turn text generation with system instruction.
 * Uses Flash-Thinking for multi-step rescue agent logic.
 */
export async function geminiText(
  system: string,
  userMessage: string,
  maxTokens = 2048,
  useThinking = false,
  usageCtx?: UsageCtx,
): Promise<string> {
  const model = useThinking ? MODEL_REASON : MODEL_FAST

  const response = await ai.models.generateContent({
    model,
    contents: userMessage,
    config: {
      systemInstruction: system,
      maxOutputTokens: maxTokens,
      temperature: 0.3,
    },
  })

  track(model, response.usageMetadata, usageCtx)
  return response.text ?? ''
}

/**
 * Single-turn text generation grounded on live Google Search results.
 * Returns the generated text plus any source URLs Gemini cited.
 */
export async function geminiSearchText(
  system: string,
  userMessage: string,
  maxTokens = 4096,
  usageCtx?: UsageCtx,
): Promise<{ text: string; sources: { title: string; uri: string }[] }> {
  const response = await ai.models.generateContent({
    model: MODEL_FAST,
    contents: userMessage,
    config: {
      systemInstruction: system,
      maxOutputTokens: maxTokens,
      temperature: 0.4,
      tools: [{ googleSearch: {} }],
    },
  })

  track(MODEL_FAST, response.usageMetadata, usageCtx)
  const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks ?? []
  const sources = chunks
    .map(c => ({ title: c.web?.title ?? '', uri: c.web?.uri ?? '' }))
    .filter(s => s.uri)

  return { text: response.text ?? '', sources }
}

/**
 * JSON generation — prompts Gemini to return valid JSON and parses it.
 */
export async function geminiJSON<T>(
  system: string,
  userMessage: string,
  usageCtx?: UsageCtx,
): Promise<T> {
  const response = await ai.models.generateContent({
    model: MODEL_FAST,
    contents: userMessage,
    config: {
      systemInstruction: system + '\n\nReturn ONLY valid JSON, no markdown fences.',
      responseMimeType: 'application/json',
      temperature: 0.2,
      maxOutputTokens: 4096,
    },
  })

  track(MODEL_FAST, response.usageMetadata, usageCtx)
  const text = response.text ?? ''
  return JSON.parse(text) as T
}
