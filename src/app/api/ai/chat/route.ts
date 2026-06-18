import { NextResponse } from 'next/server'
import { groqStream } from '@/lib/groq'
import { createClient } from '@/lib/supabase/server'
import { logActivity } from '@/lib/activity'
import { getExamPromptContext } from '@/lib/exam'

export async function POST(req: Request) {
  const { messages, topicId } = await req.json()
  const examCtx = await getExamPromptContext()

  let topicContext = ''
  if (topicId) {
    const supabase = await createClient()
    const [{ data: topic }, { data: note }] = await Promise.all([
      supabase.from('topics').select('name,paper,section,subsections').eq('id', topicId).single(),
      supabase.from('topic_notes').select('study_note').eq('topic_id', topicId).single(),
    ])
    if (topic) {
      topicContext = `\nCurrent topic: ${topic.name} (Paper ${topic.paper}, §${topic.section})\nSubsections: ${topic.subsections?.join(', ')}`
      if (note?.study_note) topicContext += `\n\nStudy note context:\n${note.study_note.slice(0, 1200)}`
    }
  }

  const system = `You are an expert AI study assistant for the ${examCtx} exam.
${topicContext}

Answer concisely in 2-4 sentences unless a longer explanation is needed. Reference specific facts, standards, and regulations relevant to this exam's field. If asked about an MCQ or multiple choice scenario, give the answer first then explain why the other options are wrong. Use markdown for formatting.`

  logActivity('ai_chat', topicId ?? null, { messageCount: messages?.length })

  try {
    const stream = await groqStream([
      { role: 'system', content: system },
      ...messages.slice(-12),
    ])

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 })
  }
}
