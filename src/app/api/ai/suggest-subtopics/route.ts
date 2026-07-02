import { NextResponse } from 'next/server'
import { quotaGuard } from '@/lib/usage'
import { groqJSON } from '@/lib/groq'
import { createClient } from '@/lib/supabase/server'
import { logActivity } from '@/lib/activity'
import { getExamPromptContext } from '@/lib/exam'
import { getTopicSource, getMcqGrounding, sourceGroundingBlock, type GroundingMode } from '@/lib/source'

export async function POST(req: Request) {
  const { topicId, topicName, mode } = await req.json()
  if (!topicId) return NextResponse.json({ error: 'Missing topicId' }, { status: 400 })
  const supabase = await createClient()

  // Deterministic: pull markdown headings straight out of the uploaded source.
  if (mode === 'headings') {
    const src = await getTopicSource(supabase, topicId)
    if (!src) return NextResponse.json({ subtopics: [], error: 'This topic has no uploaded source.' })
    const seen = new Set<string>()
    const subtopics: string[] = []
    for (const m of src.matchAll(/^#{1,4}\s+(.+?)\s*$/gm)) {
      const name = m[1].replace(/[*_`#]/g, '').trim()
      if (name && name.length <= 80 && !seen.has(name.toLowerCase())) { seen.add(name.toLowerCase()); subtopics.push(name) }
    }
    return NextResponse.json({ subtopics })
  }

  // AI modes — enforce quota.
  const blocked = await quotaGuard(); if (blocked) return blocked
  const m: GroundingMode = mode === 'note' || mode === 'general' ? mode : 'source'
  const examCtx = await getExamPromptContext()
  const grounding = await getMcqGrounding(supabase, { topicId, mode: m })

  const system = `You break an exam topic into a clean list of study subtopics for the ${examCtx} exam.

Return JSON: { "subtopics": ["name", ...] }
Rules:
- 8-15 concise subtopic names (2-6 words each), no numbering, no duplicates.
- Cover the material logically; order from foundational to advanced.
- Names only — no descriptions.`

  try {
    const ctx = { action: 'suggest_subtopics', tokens: 0 }
    const user = `Topic: "${topicName ?? ''}"${grounding ? `\n\n${sourceGroundingBlock(grounding)}` : ''}`
    const data = await groqJSON<{ subtopics: string[] }>([
      { role: 'system', content: system },
      { role: 'user', content: user },
    ], ctx, { temperature: 0.6 })
    const subtopics = (data.subtopics ?? []).map(s => String(s).trim()).filter(Boolean).slice(0, 20)
    logActivity('suggest_subtopics', topicId, { mode: m, count: subtopics.length })
    return NextResponse.json({ subtopics }, { headers: { 'X-AI-Tokens': String(ctx.tokens ?? 0) } })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 })
  }
}
