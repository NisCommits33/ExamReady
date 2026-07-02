import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/server'

interface TopicInput {
  name: string
  topic_number?: string
  paper?: number
  section?: string
  subtopics?: string[]
}

/**
 * Create one or more topics (with subtopics) under a section. Used by manual "New topic" and by
 * the syllabus-import confirm step. Authorized for the exam's owner or a super admin.
 */
export async function POST(req: Request) {
  const { user, response } = await requireUser()
  if (response || !user) return response ?? NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const sectionId: string | undefined = body.sectionId
  const inputs: TopicInput[] = Array.isArray(body.topics) ? body.topics : body.topic ? [body.topic] : []
  if (!sectionId || inputs.length === 0) {
    return NextResponse.json({ error: 'Missing sectionId or topics' }, { status: 400 })
  }

  const service = await createServiceClient()

  // Resolve the section's exam and authorize (owner or super admin).
  const { data: section } = await service.from('exam_sections').select('id,exam_id').eq('id', sectionId).maybeSingle()
  if (!section) return NextResponse.json({ error: 'Section not found' }, { status: 404 })
  const [{ data: exam }, { data: profile }] = await Promise.all([
    service.from('exams').select('created_by').eq('id', section.exam_id).maybeSingle(),
    service.from('profiles').select('role').eq('id', user.id).maybeSingle(),
  ])
  const authorized = profile?.role === 'super_admin' || exam?.created_by === user.id
  if (!authorized) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Build + insert topic rows (clamped to a sane batch).
  const clean = inputs.slice(0, 30).filter(t => t?.name?.trim())
  if (clean.length === 0) return NextResponse.json({ error: 'No valid topics' }, { status: 400 })

  const rows = clean.map((t, i) => ({
    exam_id: section.exam_id,
    section_id: sectionId,
    name: t.name.trim().slice(0, 200),
    paper: t.paper === 1 ? 1 : 2,
    section: t.section === 'A' ? 'A' : 'B',
    topic_number: String(t.topic_number ?? i + 1).trim().slice(0, 20),
    ai_priority: 5,
  }))
  const { data: inserted, error } = await service.from('topics').insert(rows).select('id,topic_number,name')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Seed subtopics for each created topic.
  const subRows: { topic_id: string; name: string; sort_order: number }[] = []
  inserted?.forEach((row, i) => {
    for (const [k, nm] of (clean[i]?.subtopics ?? []).entries()) {
      const name = String(nm ?? '').trim()
      if (name) subRows.push({ topic_id: row.id, name: name.slice(0, 200), sort_order: k })
    }
  })
  if (subRows.length) await service.from('subtopics').insert(subRows)

  return NextResponse.json({ ok: true, topics: inserted ?? [] })
}
