import { NextResponse } from 'next/server'
import { quotaGuard } from '@/lib/usage'
import { groqJSON } from '@/lib/groq'
import { createClient } from '@/lib/supabase/server'
import { logActivity } from '@/lib/activity'
import { getExamPromptContext } from '@/lib/exam'
import { getMcqGrounding, sourceGroundingBlock, type GroundingMode } from '@/lib/source'
import { shuffleQuestion } from '@/lib/mcq'

const MODES: GroundingMode[] = ['source', 'note', 'general']

export async function POST(req: Request) {
  const blocked = await quotaGuard(); if (blocked) return blocked
  const { topicName, subsections, difficulty, topicId, subtopicId, count, grounding } = await req.json()
  const examCtx = await getExamPromptContext()

  const n = Math.min(30, Math.max(1, Number(count) || 5))
  const diff = ['easy', 'medium', 'hard'].includes(difficulty) ? difficulty : 'mixed'
  const mode: GroundingMode = MODES.includes(grounding) ? grounding : 'source'

  const supabase = await createClient()
  const source = topicId ? await getMcqGrounding(supabase, { topicId, subtopicId, mode }) : null

  const system = `You are an MCQ writer for the ${examCtx} exam.

Rules:
- 4 options (A/B/C/D), exactly one correct
- Correct answer should NOT always be the longest option
- Include at least 1 question on numbers/dates/thresholds
- ${diff === 'mixed' ? 'Mix difficulty levels (easy/medium/hard)' : `All questions at "${diff}" difficulty`}
- Include traps: common misconceptions, similar-sounding terms
- Base questions on the topic's subject area and this exam's context

Return JSON:
{
  "questions": [
    {
      "question": "...",
      "options": {"A": "...", "B": "...", "C": "...", "D": "..."},
      "correct": "A",
      "explanation": "...",
      "trap": "why wrong options are tempting"
    }
  ]
}`

  try {
    // A per-request seed + explicit instruction so repeated drills don't return the same questions.
    const seed = Math.random().toString(36).slice(2, 8)
    const variation = `\n\nVariation seed: ${seed}. Produce a FRESH, DIFFERENT set of questions from any previous run — vary the angles, wording, and which facts you test. Avoid the most obvious textbook examples.`
    const baseUserContent = `Generate ${n} MCQs for: "${topicName}"\nSubsections: ${(subsections ?? []).join(', ')}\nDifficulty: ${diff}${variation}`
    const ctx = { action: 'generate_mcq', tokens: 0 }
    const data = await groqJSON<{ questions: unknown[] }>([
      { role: 'system', content: system },
      {
        role: 'user',
        content: source ? `${baseUserContent}\n\n${sourceGroundingBlock(source)}` : baseUserContent,
      },
    ], ctx, { temperature: 0.9 })
    const questions = (data.questions ?? []).map(q => shuffleQuestion(q as { question: string; options: Record<string, string>; correct: string; explanation?: string; trap?: string }))
    logActivity('generate_mcq', topicId ?? null, { topic: topicName, difficulty: diff, count: questions.length, grounding: mode })
    return NextResponse.json({ questions }, { headers: { 'X-AI-Tokens': String(ctx.tokens ?? 0) } })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 })
  }
}
