import { NextResponse } from 'next/server'
import { quotaGuard } from '@/lib/usage'
import { groqJSON } from '@/lib/groq'
import { logActivity } from '@/lib/activity'

export async function POST(req: Request) {
  const blocked = await quotaGuard(); if (blocked) return blocked
  const { scope, count } = await req.json()
  const n = count ?? 10

  const system = `You are a General Knowledge question writer for the Nepal CAAN Level 5 public service exam.

Generate realistic exam-style GK MCQs. Rules:
- Include exact figures, years, and regulatory references where relevant
- For aviation topics: reference ICAO Annex numbers, CAAN regulations, Nepal Civil Aviation Act
- For Nepal topics: reference Nepal Constitution 2072, federal structure, geography facts
- For world topics: include current international organizations, science facts, global events
- Each question must have exactly 4 options (A, B, C, D) with one correct answer
- Explanation must state WHY the answer is correct with a source reference

Return JSON:
{
  "questions": [
    {
      "question_text": "...",
      "options": {"A": "...", "B": "...", "C": "...", "D": "..."},
      "correct_answer": "A",
      "explanation": "clear reason with source/reference",
      "difficulty": "easy|medium|hard"
    }
  ]
}`

  try {
    const ctx = { action: 'generate_gk', tokens: 0 }
    const data = await groqJSON<{ questions: unknown[] }>([
      { role: 'system', content: system },
      {
        role: 'user',
        content: `Generate ${n} GK MCQ questions.\nScope: ${scope}\nMix difficulty levels (roughly 30% easy, 50% medium, 20% hard).`,
      },
    ], ctx)
    logActivity('generate_gk', null, { scope, count: n })
    return NextResponse.json(data, { headers: { 'X-AI-Tokens': String(ctx.tokens ?? 0) } })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 })
  }
}
