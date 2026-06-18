import { NextResponse } from 'next/server'
import { groqJSON } from '@/lib/groq'
import { logActivity } from '@/lib/activity'
import { getExamPromptContext } from '@/lib/exam'

export async function POST(req: Request) {
  const { topicName, questionType, userAnswer, modelAnswer, questionContext, gradingHints } = await req.json()
  const examCtx = await getExamPromptContext()

  const marks = questionType === '5mark' ? 5 : 10

  const system = `You are an examiner for the ${examCtx} exam.

Grade this written answer as an official examiner. Be specific about which points earn marks.
Reference accurate domain context for this exam's field. Score out of ${marks}.

After grading, provide a model answer that would score full marks for this question.
The model answer should be concise, well-structured, and demonstrate the depth expected for a ${marks}-mark answer.

Return JSON:
{
  "score": <number 0-${marks}>,
  "feedback": "detailed paragraph explaining how the answer was graded",
  "strong": ["point that earned marks", ...],
  "missing": ["concept not covered", ...],
  "model_answer": "a complete model answer that would score full marks"
}`

  const userParts = [`Topic: ${topicName}`, `Question type: ${marks}-mark answer`]
  if (questionContext) userParts.push(`Question: ${questionContext}`)
  if (gradingHints?.length) userParts.push(`Key points to check: ${gradingHints.join(', ')}`)
  if (modelAnswer) userParts.push(`Model hints: ${modelAnswer}`)
  userParts.push(`\nStudent answer:\n${userAnswer}`)

  try {
    const data = await groqJSON<{
      score: number
      feedback: string
      strong: string[]
      missing: string[]
      model_answer: string
    }>([
      { role: 'system', content: system },
      { role: 'user', content: userParts.join('\n') },
    ])
    logActivity('grade_answer', null, { topic: topicName, marks, score: data.score })
    return NextResponse.json(data)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 })
  }
}
