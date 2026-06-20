import { NextResponse } from 'next/server'
import { quotaGuard } from '@/lib/usage'
import { geminiSearchText } from '@/lib/gemini'
import { groqText } from '@/lib/groq'
import { createClient } from '@/lib/supabase/server'
import { getExamPromptContext } from '@/lib/exam'
import { logActivity } from '@/lib/activity'
import { hashContent, getCachedTransform, saveTransform } from '@/lib/ai-cache'

export async function POST(req: Request) {
  const blocked = await quotaGuard(); if (blocked) return blocked
  const { text, topicName } = await req.json()
  if (!text) return NextResponse.json({ error: 'Missing text' }, { status: 400 })

  const supabase = await createClient()
  const hash = hashContent(String(text))

  // Return a previously stored elaboration if the source text is unchanged.
  const cached = await getCachedTransform(supabase, hash, 'elaborate')
  if (cached) return NextResponse.json({ text: cached.output, sources: cached.sources, web: cached.web, cached: true })

  const examCtx = await getExamPromptContext()
  const material = String(text).slice(0, 8000)

  const baseRules = `Output clean Markdown: use "##" and "###" headings, bullet/numbered lists, and **bold** for key terms.
- Add depth the source lacks: definitions, context, worked examples, and how the topic is tested.
- Keep EVERY exam-critical number, date, threshold and section reference from the source.
- Stay strictly on this topic. Do not invent facts you cannot support.`

  const ctx: { action: string; tokens?: number } = { action: 'elaborate' }
  const tokenHeader = () => ({ 'X-AI-Tokens': String(ctx.tokens ?? 0) })

  // Primary: Gemini with live Google Search grounding.
  try {
    const system = `You are an expert tutor for the ${examCtx} exam. Expand and ELABORATE the provided material into a comprehensive, well-structured study explanation.

Rules:
- ${baseRules}
- Use Google Search to enrich with accurate, up-to-date facts; prefer authoritative/official sources.`

    const { text: elaborated, sources } = await geminiSearchText(
      system,
      `Topic: ${topicName ?? 'General'}\n\nElaborate this material:\n\n${material}`,
      4096,
      ctx,
    )
    if (elaborated.trim()) {
      await saveTransform(supabase, hash, 'elaborate', elaborated, { sources, web: true, topicName })
      logActivity('elaborate', null, { topic: topicName, sources: sources.length, web: true })
      return NextResponse.json({ text: elaborated, sources, web: true }, { headers: tokenHeader() })
    }
  } catch (e) {
    console.error('elaborate: Gemini failed, falling back to Groq —', String(e))
  }

  // Fallback: Groq (no live web search) so the feature still works when Gemini is unavailable.
  try {
    const system = `You are an expert tutor for the ${examCtx} exam. Expand and ELABORATE the provided material into a comprehensive, well-structured study explanation using your own knowledge.

Rules:
- ${baseRules}`

    const elaborated = await groqText([
      { role: 'system', content: system },
      { role: 'user', content: `Topic: ${topicName ?? 'General'}\n\nElaborate this material:\n\n${material}` },
    ], 4096, ctx)
    if (!elaborated.trim()) return NextResponse.json({ error: 'No elaboration produced' }, { status: 502 })

    await saveTransform(supabase, hash, 'elaborate', elaborated, { sources: [], web: false, topicName })
    logActivity('elaborate', null, { topic: topicName, sources: 0, web: false })
    return NextResponse.json({ text: elaborated, sources: [], web: false }, { headers: tokenHeader() })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 })
  }
}
