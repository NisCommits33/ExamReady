import { NextResponse } from 'next/server'
import { quotaGuard } from '@/lib/usage'
import { groqJSON } from '@/lib/groq'
import { logActivity } from '@/lib/activity'
import { getExamPromptContext } from '@/lib/exam'

// Feynman technique: grade a plain-language explanation for clarity, jargon, and knowledge gaps.
export async function POST(req: Request) {
  const blocked = await quotaGuard(); if (blocked) return blocked
  const { topicName, explanation, keyPoints } = await req.json()
  const examCtx = await getExamPromptContext()

  const system = `You are a study coach applying the Feynman technique for the ${examCtx} exam.

The student is trying to explain a topic in simple language, as if teaching a 12-year-old.
Judge how well they truly understand it. Reward plain language and correct substance; penalise
hidden jargon, hand-waving, and missing core ideas.

Return JSON:
{
  "clarity_score": <number 0-10>,
  "jargon": ["term used without being explained", ...],
  "gaps": ["important idea they missed or got wrong — short, self-contained", ...],
  "analogy_suggestions": ["a simple analogy that would make this click", ...],
  "simpler_rewrite": "a 3-5 sentence model explanation a beginner would understand"
}`

  const userParts = [`Topic: ${topicName}`]
  if (keyPoints) userParts.push(`Key points that SHOULD be covered:\n${keyPoints}`)
  userParts.push(`\nStudent's explanation:\n${explanation}`)

  try {
    const ctx = { action: 'evaluate_explanation', tokens: 0 }
    const data = await groqJSON<{
      clarity_score: number
      jargon: string[]
      gaps: string[]
      analogy_suggestions: string[]
      simpler_rewrite: string
    }>([
      { role: 'system', content: system },
      { role: 'user', content: userParts.join('\n') },
    ], ctx)
    logActivity('evaluate_explanation', null, { topic: topicName, clarity: data.clarity_score })
    return NextResponse.json(data, { headers: { 'X-AI-Tokens': String(ctx.tokens ?? 0) } })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 })
  }
}
