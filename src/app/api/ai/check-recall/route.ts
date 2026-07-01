import { NextResponse } from 'next/server'
import { quotaGuard } from '@/lib/usage'
import { groqJSON } from '@/lib/groq'
import { logActivity } from '@/lib/activity'
import { getExamPromptContext } from '@/lib/exam'

// Active recall: compare a free-recall "brain dump" against the topic's key points.
export async function POST(req: Request) {
  const blocked = await quotaGuard(); if (blocked) return blocked
  const { topicName, recall, keyPoints } = await req.json()
  const examCtx = await getExamPromptContext()

  const system = `You are a study coach checking a student's active-recall attempt for the ${examCtx} exam.

The student wrote down everything they remember about a topic WITHOUT looking. Compare it to the
reference key points. Be encouraging but honest.

Return JSON:
{
  "covered": ["key idea they correctly recalled", ...],
  "missed": ["important key point they did NOT mention — short, self-contained", ...],
  "wrong": ["something they stated that is incorrect or confused", ...],
  "score_pct": <number 0-100 estimate of how much they recalled>
}`

  const userParts = [`Topic: ${topicName}`]
  if (keyPoints) userParts.push(`Reference key points:\n${keyPoints}`)
  userParts.push(`\nStudent's recall attempt:\n${recall}`)

  try {
    const ctx = { action: 'check_recall', tokens: 0 }
    const data = await groqJSON<{
      covered: string[]
      missed: string[]
      wrong: string[]
      score_pct: number
    }>([
      { role: 'system', content: system },
      { role: 'user', content: userParts.join('\n') },
    ], ctx)
    logActivity('check_recall', null, { topic: topicName, score: data.score_pct })
    return NextResponse.json(data, { headers: { 'X-AI-Tokens': String(ctx.tokens ?? 0) } })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 })
  }
}
