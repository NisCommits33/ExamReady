import { NextResponse } from 'next/server'
import { quotaGuard } from '@/lib/usage'
import { groqStream } from '@/lib/groq'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { logActivity } from '@/lib/activity'
import { getExamPromptContext } from '@/lib/exam'
import { retrieve, ragGroundingBlock } from '@/lib/rag'

export async function POST(req: Request) {
  const blocked = await quotaGuard(); if (blocked) return blocked
  const { messages, topicId } = await req.json()
  const examCtx = await getExamPromptContext()

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const lastUser = [...(messages ?? [])].reverse().find((m: { role: string }) => m.role === 'user')?.content ?? ''

  // Topic framing (name + subsections) — cheap and useful even without retrieval.
  let topicContext = ''
  let noteFallback = ''
  if (topicId) {
    const [{ data: topic }, { data: note }, { data: subs }] = await Promise.all([
      supabase.from('topics').select('name,paper,section').eq('id', topicId).single(),
      supabase.from('topic_notes').select('study_note').eq('topic_id', topicId).maybeSingle(),
      supabase.from('subtopics').select('name,sort_order').eq('topic_id', topicId).order('sort_order'),
    ])
    if (topic) {
      const subsections = (subs ?? []).map(s => s.name)
      topicContext = `\nCurrent topic: ${topic.name} (Paper ${topic.paper}, §${topic.section})\nSubsections: ${subsections.join(', ')}`
    }
    if (note?.study_note) noteFallback = note.study_note.slice(0, 1200)
  }

  // RAG: retrieve passages relevant to the question; fall back to the naive note slice if empty.
  const service = await createServiceClient()
  const passages = await retrieve(service, lastUser, { topicId, userId: user?.id ?? null, k: 6 })
  const grounding = passages.length > 0
    ? ragGroundingBlock(passages)
    : (noteFallback ? `Study note context:\n${noteFallback}` : '')

  const system = `You are an expert AI study assistant for the ${examCtx} exam.
${topicContext}

${grounding}

Answer concisely in 2-4 sentences unless a longer explanation is needed. Reference specific facts, standards, and regulations relevant to this exam's field. If asked about an MCQ or multiple choice scenario, give the answer first then explain why the other options are wrong. Use markdown for formatting.`

  logActivity('ai_chat', topicId ?? null, { messageCount: messages?.length })

  try {
    const stream = await groqStream([
      { role: 'system', content: system },
      ...messages.slice(-12),
    ], { action: 'ai_chat' })

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
