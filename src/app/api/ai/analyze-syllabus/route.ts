import { NextResponse } from 'next/server'
import { quotaGuard } from '@/lib/usage'
import { groqJSON } from '@/lib/groq'
import { logActivity } from '@/lib/activity'

type Kind = 'mcq_study' | 'aptitude' | 'written'

/**
 * Analyze a syllabus into a section/topic structure for PREVIEW only — no DB writes, no subtopics.
 * The client shows this, the user selects which topics to keep, then commits via /api/ai/scaffold-exam.
 */
export async function POST(req: Request) {
  const blocked = await quotaGuard(); if (blocked) return blocked
  const { examName, syllabus } = await req.json()
  if (!syllabus || String(syllabus).trim().length < 20) {
    return NextResponse.json({ error: 'Provide a longer syllabus' }, { status: 400 })
  }

  const system = `You convert an exam syllabus into a study-course structure. Be FAITHFUL to the syllabus:
extract the topics that are actually there — do not invent, do not over-merge distinct topics, and do
not drop parts. Preserve the syllabus's own chapters/units and numbering where present.

Section "kind" must be one of:
- "mcq_study": knowledge subjects studied via notes + multiple-choice practice (most academic subjects)
- "aptitude": reasoning / IQ / quantitative aptitude drilled with practice questions (empty topics array)
- "written": subjects assessed by long written/descriptive answers

Return JSON:
{ "sections": [ { "name": "Section name", "kind": "mcq_study|aptitude|written",
    "topics": [ { "name": "Topic name", "topic_number": "1.1", "paper": 1 } ] } ] }

Rules:
- The syllabus may contain MULTIPLE PAPERS, marked like "=== PAPER 1 ===". Set each topic's "paper"
  field (1 or 2; use 1 if unmarked) and group papers into sections sensibly.
- Create ONE topic per genuine chapter/unit/topic. Cover the WHOLE syllabus — if it lists 25 topics,
  return ~25, not a summary of 8. Do NOT include subtopics.
- topic_number: reuse the syllabus's own numbering ("1", "1.1", "2.3") where present.
- Keep names concise and faithful to the syllabus wording.`

  try {
    const ctx = { action: 'analyze_syllabus', tokens: 0 }
    const data = await groqJSON<{ sections: { name: string; kind: Kind; topics?: { name: string; topic_number?: string; paper?: number }[] }[] }>([
      { role: 'system', content: system },
      { role: 'user', content: `Exam: ${examName ?? ''}\n\nSyllabus:\n${String(syllabus).slice(0, 30000)}` },
    ], ctx, { temperature: 0.3, maxTokens: 8000 })

    const sections = (Array.isArray(data.sections) ? data.sections : []).slice(0, 10).map((s, si) => ({
      name: String(s.name ?? `Section ${si + 1}`).trim(),
      kind: (['mcq_study', 'aptitude', 'written'].includes(s.kind) ? s.kind : 'mcq_study') as Kind,
      topics: (Array.isArray(s.topics) ? s.topics : []).filter(t => t?.name?.trim()).slice(0, 40).map((t, ti) => ({
        name: t.name.trim(),
        topic_number: String(t.topic_number ?? ti + 1).trim(),
        paper: t.paper === 2 ? 2 : 1,
      })),
    })).filter(s => s.kind === 'aptitude' || s.topics.length > 0)

    if (sections.length === 0) return NextResponse.json({ error: 'No topics could be extracted' }, { status: 502 })

    logActivity('analyze_syllabus', null, { sections: sections.length, topics: sections.reduce((n, s) => n + s.topics.length, 0) })
    return NextResponse.json({ sections }, { headers: { 'X-AI-Tokens': String(ctx.tokens ?? 0) } })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 })
  }
}
