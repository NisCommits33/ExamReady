import { NextResponse } from 'next/server'
import { quotaGuard } from '@/lib/usage'
import { groqJSON } from '@/lib/groq'
import { createClient } from '@/lib/supabase/server'
import { logActivity } from '@/lib/activity'
import { getExamPromptContext } from '@/lib/exam'

export async function POST(req: Request) {
  const blocked = await quotaGuard(); if (blocked) return blocked
  const { topicName, subsections, marks, topicId, excludeQuestions } = await req.json()
  if (!topicName || !marks) {
    return NextResponse.json({ error: 'Missing topicName or marks' }, { status: 400 })
  }
  const examCtx = await getExamPromptContext()

  const markCount = marks === '5mark' ? 5 : 10

  // Questions already asked: answered ones (from the DB) plus ones shown this session (from the client).
  let previousQuestions: string[] = Array.isArray(excludeQuestions)
    ? (excludeQuestions as unknown[]).filter((q): q is string => typeof q === 'string' && q.trim().length > 0)
    : []
  if (topicId) {
    try {
      const supabase = await createClient()
      const { data } = await supabase
        .from('p2_answers')
        .select('question_text')
        .eq('topic_id', topicId)
        .not('question_text', 'is', null)
        .order('attempted_at', { ascending: false })
        .limit(10)
      const answered = (data ?? []).map(r => r.question_text).filter(Boolean) as string[]
      previousQuestions = [...new Set([...previousQuestions, ...answered])].slice(0, 20)
    } catch {}
  }

  const avoidBlock = previousQuestions.length > 0
    ? `\n\nIMPORTANT: The student has already been asked these questions — do NOT repeat or rephrase any of them. Generate a completely different question covering a different aspect of the topic:\n${previousQuestions.map((q, i) => `${i + 1}. ${q}`).join('\n')}`
    : ''

  // A per-request seed + explicit instruction so repeated generations don't return the same question.
  const seed = Math.random().toString(36).slice(2, 8)
  const variation = `\n\nVariation seed: ${seed}. Produce a FRESH, DIFFERENT question from any previous run — vary the angle, wording, and which subsection you test. Avoid the most obvious textbook phrasing.`

  try {
    const ctx = { action: 'generate_p2_question', tokens: 0 }
    const data = await groqJSON<{ question: string; hints: string[] }>([
      {
        role: 'system',
        content: `You are a paper setter for the ${examCtx} exam.

Write a single descriptive exam question worth ${markCount} marks.

Style rules — match these real exam question formats exactly:
${markCount === 5 ? `
- "What are the [types/duties/procedures] of [topic]? State."
- "What do you know about [concept]?"
- "Define [term] and explain [application]."
- "What is [concept]? Write its [types/causes/methods]."
- "Why is [concept] important in fire service?"
- "In what condition [scenario]? Explain."
` : `
- "What is [major concept]? Discuss in detail."
- "What are the [roles/responsibilities] of [position] in case of [scenario]? Explain."
- "How does [equipment/system] work? Explain in detail."
- "Discuss the [procedure/principle] and explain how it applies at airports."
`}

Return JSON:
{
  "question": "The full question text ending with (${markCount} marks)",
  "hints": ["hint 1 — key point to cover", "hint 2", "hint 3"]
}

Provide 3 concise hints — the key points a strong answer should cover. These help the student if they get stuck, and guide AI grading.
Make the question specific to the topic, not generic. Ground it in this exam's real-world field.${avoidBlock}${variation}`,
      },
      {
        role: 'user',
        content: `Topic: ${topicName}\nSubsections: ${(subsections ?? []).join(', ')}\nMarks: ${markCount}`,
      },
    ], ctx, { temperature: 0.9 })

    logActivity('generate_p2_question', topicId, { marks: markCount, question: data.question })
    return NextResponse.json({ question: data.question, hints: data.hints, marks: markCount }, { headers: { 'X-AI-Tokens': String(ctx.tokens ?? 0) } })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 })
  }
}
