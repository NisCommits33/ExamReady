import { NextResponse } from 'next/server'
import { groqJSON } from '@/lib/groq'
import { IQ_QUESTION_TYPES } from '@/lib/constants'
import { logActivity } from '@/lib/activity'

export async function POST(req: Request) {
  const { type, count, difficulty } = await req.json()

  const isRandom = type === 'random'
  const picked = isRandom
    ? IQ_QUESTION_TYPES[Math.floor(Math.random() * IQ_QUESTION_TYPES.length)]
    : IQ_QUESTION_TYPES.find(t => t.id === type)

  const isNonVerbal = picked?.category === 'non_verbal'

  const system = `You are an IQ / aptitude test question generator (Verbal Reasoning, Non-verbal Reasoning, Arithmetic) for a competitive exam.

You can include figures as inline SVG markup. Use SVG for any visual/figure-based question (figure series, mirror images, water images, figure matrix, Venn diagrams, figure analogy/classification).

SVG rules:
- Each figure must be a complete, valid, self-contained <svg> element with viewBox="0 0 100 100", width="100" height="100".
- Use simple shapes: <rect>, <circle>, <polygon>, <line>, <path>, <ellipse>. Use stroke="currentColor" and fill="none" or fill="currentColor" so figures adapt to light/dark themes. Stroke-width 2-3.
- For rotations/reflections use transform="rotate(...)" or transform="scale(-1,1)".
- Keep each figure clean and unambiguous — the pattern must be visually clear.
- Do NOT include <script>, external images, or text labels inside the SVG unless essential.

For each question return these fields:
- "question_text": the instruction (e.g. "Which figure completes the series?"). Always required.
- "question_figure": inline SVG string showing the sequence/matrix/figures for the prompt, or null for non-visual questions. For a series, draw all given figures left-to-right with a "?" box for the missing one, inside ONE svg with viewBox="0 0 400 100".
- "options": { "A": ..., "B": ..., "C": ..., "D": ... } — each value is EITHER plain text (verbal/arithmetic) OR a complete inline <svg> string (visual questions). All four options must be the same kind.
- "correct_answer": "A" | "B" | "C" | "D"
- "explanation": step-by-step reasoning.
- "difficulty": "easy" | "medium" | "hard"

${isNonVerbal
  ? 'These are NON-VERBAL questions — question_figure and all four options MUST be inline SVG figures.'
  : 'These are mostly text questions — set question_figure to null and use text options, UNLESS a figure genuinely helps.'}

Return JSON: { "questions": [ ... ] }`

  try {
    const data = await groqJSON<{ questions: unknown[] }>([
      { role: 'system', content: system },
      {
        role: 'user',
        content: `Generate ${count} ${picked?.label ?? 'mixed reasoning'} questions (category: ${picked?.category ?? 'verbal'}). Difficulty mix: ${difficulty}.`,
      },
    ])
    logActivity('generate_iq', null, { type: picked?.id, category: picked?.category, count, difficulty })
    return NextResponse.json(data)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 })
  }
}
