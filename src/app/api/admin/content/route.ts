import { NextResponse } from 'next/server'
import { assertSuperAdmin } from '@/lib/admin'
import { createServiceClient } from '@/lib/supabase/server'

export async function POST(req: Request) {
  const adminId = await assertSuperAdmin()
  if (!adminId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const { action } = body
  const service = await createServiceClient()

  try {
    switch (action) {
      case 'updateExam': {
        const { examId, fields } = body
        if (!examId || !fields) return NextResponse.json({ error: 'Missing examId/fields' }, { status: 400 })
        const allowed: Record<string, unknown> = {}
        for (const k of ['name', 'body', 'description', 'is_public']) if (k in fields) allowed[k] = fields[k]
        const { error } = await service.from('exams').update(allowed).eq('id', examId)
        if (error) throw error
        return NextResponse.json({ ok: true })
      }
      case 'updateShiftType': {
        const { type, study_start, study_end } = body
        if (!type || !study_start || !study_end) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
        if (study_end <= study_start) return NextResponse.json({ error: 'End must be after start' }, { status: 400 })
        const { error } = await service.from('shift_types').update({ study_start, study_end }).eq('type', type)
        if (error) throw error
        return NextResponse.json({ ok: true })
      }
      case 'addTopic': {
        const { examId, name, paper, section, topic_number, sectionId } = body
        if (!examId || !name?.trim() || !topic_number?.trim()) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
        if (!sectionId) return NextResponse.json({ error: 'Pick a section so the topic is visible to users' }, { status: 400 })
        const { error } = await service.from('topics').insert({
          exam_id: examId, section_id: sectionId, name: name.trim(), paper: paper ?? 2, section: section ?? 'B',
          topic_number: String(topic_number).trim(), subsections: [], ai_priority: 5,
        })
        if (error) throw error
        return NextResponse.json({ ok: true })
      }
      case 'deleteTopic': {
        const { topicId } = body
        if (!topicId) return NextResponse.json({ error: 'Missing topicId' }, { status: 400 })
        const { error } = await service.from('topics').delete().eq('id', topicId)
        if (error) throw error
        return NextResponse.json({ ok: true })
      }
      case 'getTopicSource': {
        const { topicId } = body
        if (!topicId) return NextResponse.json({ error: 'Missing topicId' }, { status: 400 })
        const { data } = await service.from('topic_notes').select('official_source').eq('topic_id', topicId).maybeSingle()
        return NextResponse.json({ source: data?.official_source ?? '' })
      }
      case 'setTopicSource': {
        const { topicId, source } = body
        if (!topicId) return NextResponse.json({ error: 'Missing topicId' }, { status: 400 })
        const value = typeof source === 'string' && source.trim() ? source.trim() : null
        const { error } = await service.from('topic_notes').upsert(
          { topic_id: topicId, official_source: value, updated_at: new Date().toISOString() },
          { onConflict: 'topic_id' },
        )
        if (error) throw error
        return NextResponse.json({ ok: true })
      }
      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
    }
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
