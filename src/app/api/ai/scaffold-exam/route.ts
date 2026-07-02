import { NextResponse } from 'next/server'
import { quotaGuard } from '@/lib/usage'
import { requireUser } from '@/lib/auth'
import { groqJSON } from '@/lib/groq'
import { createServiceClient } from '@/lib/supabase/server'
import { logActivity } from '@/lib/activity'

type Kind = 'mcq_study' | 'aptitude' | 'written'
interface InSection { name: string; kind: Kind; topics?: { name: string; topic_number?: string; paper?: number }[] }

/**
 * Create sections + topics for an exam. Subtopics are NOT created here — the user adds those later.
 * Two modes:
 *  - Commit a user-reviewed structure: pass `sections` (from /api/ai/analyze-syllabus, after selection).
 *  - Legacy one-shot: pass `syllabus` and the AI generates the structure.
 * Authorized for the exam's owner or a super admin.
 */
export async function POST(req: Request) {
  const blocked = await quotaGuard(); if (blocked) return blocked
  const { user, response } = await requireUser()
  if (response || !user) return response ?? NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { examId, examName, syllabus, sections: providedSections } = await req.json()
  if (!examId) return NextResponse.json({ error: 'Missing examId' }, { status: 400 })

  // Catalog tables are super-admin-write under RLS; authorize the owner/admin, then use the service client.
  const supabase = await createServiceClient()
  const [{ data: exam }, { data: profile }] = await Promise.all([
    supabase.from('exams').select('created_by').eq('id', examId).maybeSingle(),
    supabase.from('profiles').select('role').eq('id', user.id).maybeSingle(),
  ])
  if (!exam) return NextResponse.json({ error: 'Exam not found' }, { status: 404 })
  if (exam.created_by !== user.id && profile?.role !== 'super_admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    // Use the reviewed structure if provided; otherwise generate it from the syllabus.
    let sections: InSection[]
    if (Array.isArray(providedSections) && providedSections.length) {
      sections = providedSections as InSection[]
    } else {
      const system = `You convert an exam syllabus into a study-course structure. Be FAITHFUL: extract the
topics that are actually there — don't invent, over-merge, or drop parts. Preserve the syllabus's own
chapters/units and numbering.

Section "kind": "mcq_study" (knowledge subjects), "aptitude" (reasoning drills, empty topics), or "written".

Return JSON: { "sections": [ { "name": "...", "kind": "mcq_study|aptitude|written",
  "topics": [ { "name": "...", "topic_number": "1.1", "paper": 1 } ] } ] }

Rules: the syllabus may contain MULTIPLE PAPERS (marked "=== PAPER 1 ==="); set each topic's "paper"
(1 or 2). Create ONE topic per genuine chapter/unit and cover the WHOLE syllabus. No subtopics.`
      const data = await groqJSON<{ sections: InSection[] }>([
        { role: 'system', content: system },
        { role: 'user', content: `Exam: ${examName ?? ''}\n\nSyllabus:\n${(syllabus ?? '').slice(0, 30000)}` },
      ], { action: 'scaffold_exam' }, { maxTokens: 8000 })
      sections = Array.isArray(data.sections) ? data.sections : []
    }

    sections = sections.slice(0, 10)
    if (sections.length === 0) return NextResponse.json({ error: 'No sections to create' }, { status: 502 })

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

      const topics = (sec.topics ?? []).filter(t => t?.name?.trim()).slice(0, 40)
      if (topics.length) {
        const rows = topics.map((t, j) => {
          const paper = t.paper === 2 ? 2 : 1
          return {
            exam_id: examId,
            section_id: insertedSection.id,
            name: String(t.name).trim().slice(0, 200),
            paper,
            section: paper === 2 ? 'B' : 'A',
            topic_number: String(t.topic_number ?? topicCount + j + 1).trim().slice(0, 20),
            ai_priority: 5,
          }
        })
        const { data: inserted } = await supabase.from('topics').insert(rows).select('id')
        topicCount += inserted?.length ?? 0
      }
    }

    logActivity('scaffold_exam', null, { examId, sectionCount, topicCount })
    return NextResponse.json({ ok: true, sectionCount, topicCount })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 })
  }
}
