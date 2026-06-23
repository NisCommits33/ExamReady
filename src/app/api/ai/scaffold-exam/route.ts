import { NextResponse } from 'next/server'
import { quotaGuard } from '@/lib/usage'
import { groqJSON } from '@/lib/groq'
import { createClient } from '@/lib/supabase/server'
import { logActivity } from '@/lib/activity'

type Kind = 'mcq_study' | 'aptitude' | 'written'

export async function POST(req: Request) {
  const blocked = await quotaGuard(); if (blocked) return blocked
  const { examId, examName, syllabus } = await req.json()
  if (!examId) return NextResponse.json({ error: 'Missing examId' }, { status: 400 })

  const supabase = await createClient()

  const system = `You design the structure of a study course for a competitive exam.

Given an exam name and an optional syllabus, return a JSON structure of sections and their topics.

Section "kind" must be one of:
- "mcq_study": subjects studied via notes + multiple-choice practice (most academic/knowledge subjects)
- "aptitude": reasoning / IQ / quantitative aptitude drilled with practice questions (no reading topics)
- "written": subjects assessed by long written/descriptive answers

Return JSON:
{
  "sections": [
    { "name": "Section name", "kind": "mcq_study|aptitude|written",
      "topics": [ { "name": "Topic name", "topic_number": "1.1", "subsections": ["sub a","sub b"] } ] }
  ]
}

Rules:
- 1-5 sections. Aptitude sections have an empty topics array.
- 3-12 topics per study section, covering the syllabus breadth.
- topic_number is a short label like "1", "1.1", "2".
- Keep names concise and exam-appropriate.`

  try {
    const data = await groqJSON<{ sections: { name: string; kind: Kind; topics?: { name: string; topic_number: string; subsections?: string[] }[] }[] }>([
      { role: 'system', content: system },
      { role: 'user', content: `Exam: ${examName ?? ''}\n\nSyllabus (may be empty):\n${(syllabus ?? '').slice(0, 6000)}` },
    ], { action: 'scaffold_exam' })

    const sections = (data.sections ?? []).slice(0, 6)
    let sectionCount = 0
    let topicCount = 0

    for (let i = 0; i < sections.length; i++) {
      const sec = sections[i]
      const kind: Kind = ['mcq_study', 'aptitude', 'written'].includes(sec.kind) ? sec.kind : 'mcq_study'
      const { data: insertedSection } = await supabase
        .from('exam_sections')
        .insert({ exam_id: examId, name: sec.name, kind, sort_order: i + 1 })
        .select('id')
        .single()
      if (!insertedSection) continue
      sectionCount++

      const topics = (sec.topics ?? []).slice(0, 15)
      if (topics.length) {
        const rows = topics.map((t, j) => ({
          exam_id: examId,
          section_id: insertedSection.id,
          name: t.name,
          paper: 1,
          section: 'A',
          topic_number: t.topic_number ?? String(topicCount + j + 1),
          subsections: t.subsections ?? [],
          ai_priority: 5,
        }))
        const { data: inserted, error } = await supabase.from('topics').insert(rows).select('id,topic_number')
        if (!error && inserted) {
          topicCount += inserted.length
          // Seed subtopic rows from each topic's subsections (subtopics table is the source of truth).
          const idByNum = new Map(inserted.map(r => [r.topic_number, r.id]))
          const subRows: { topic_id: string; name: string; sort_order: number }[] = []
          for (const r of rows) {
            const tid = idByNum.get(r.topic_number)
            if (!tid) continue
            r.subsections.forEach((nm: string, k: number) => {
              const name = String(nm ?? '').trim()
              if (name) subRows.push({ topic_id: tid, name, sort_order: k })
            })
          }
          if (subRows.length) await supabase.from('subtopics').insert(subRows)
        }
      }
    }

    logActivity('scaffold_exam', null, { examId, sectionCount, topicCount })
    return NextResponse.json({ ok: true, sectionCount, topicCount })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 })
  }
}
