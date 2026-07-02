import { NextResponse } from 'next/server'
import { quotaGuard } from '@/lib/usage'
import { groqJSON } from '@/lib/groq'
import { logActivity } from '@/lib/activity'
import { getExamPromptContext } from '@/lib/exam'

/**
 * Turn a pasted/extracted syllabus into a preview list of topics + subtopics for ONE section.
 * Returns the parsed structure only — the client confirms, then POSTs to /api/topics/create.
 */
export async function POST(req: Request) {
  const blocked = await quotaGuard(); if (blocked) return blocked
  const { syllabus, sectionName } = await req.json()
  if (!syllabus || String(syllabus).trim().length < 20) {
    return NextResponse.json({ error: 'Provide a longer syllabus' }, { status: 400 })
  }
  const examCtx = await getExamPromptContext()

  const system = `You structure a syllabus into study topics for the ${examCtx} exam${sectionName ? `, section "${sectionName}"` : ''}.

Return JSON:
{ "topics": [ { "name": "Topic name", "topic_number": "1", "subtopics": ["sub a","sub b"] } ] }

Rules:
- Create ONE topic per genuine chapter/unit/topic in the syllabus and cover the WHOLE syllabus — if it
  lists 25 topics, return ~25, not a summary. Do not over-merge distinct topics or drop parts.
- topic_number: reuse the syllabus's own numbering ("1", "1.1", "2.3") where present.
- subtopics = the sub-points listed under that topic in the syllabus (0-12 each).
- Do not invent content beyond the syllabus's scope.`

  try {
    const ctx = { action: 'generate_topics', tokens: 0 }
    const data = await groqJSON<{ topics: { name: string; topic_number?: string; subtopics?: string[] }[] }>([
      { role: 'system', content: system },
      { role: 'user', content: `Syllabus:\n${String(syllabus).slice(0, 24000)}` },
    ], ctx, { temperature: 0.4, maxTokens: 8000 })

    const topics = (Array.isArray(data.topics) ? data.topics : [])
      .filter(t => t?.name?.trim())
      .slice(0, 40)
      .map((t, i) => ({
        name: t.name.trim(),
        topic_number: String(t.topic_number ?? i + 1).trim(),
        subtopics: (Array.isArray(t.subtopics) ? t.subtopics : []).map(s => String(s).trim()).filter(Boolean).slice(0, 12),
      }))
    if (topics.length === 0) return NextResponse.json({ error: 'No topics could be extracted' }, { status: 502 })

    logActivity('generate_topics', null, { count: topics.length })
    return NextResponse.json({ topics }, { headers: { 'X-AI-Tokens': String(ctx.tokens ?? 0) } })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 })
  }
}
