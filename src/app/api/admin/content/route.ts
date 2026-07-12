import { NextResponse } from 'next/server'
import { assertSuperAdmin } from '@/lib/admin'
import { isSourceLanguage } from '@/lib/language'
import { createServiceClient } from '@/lib/supabase/server'

export async function POST(req: Request) {
  const adminId = await assertSuperAdmin()
  if (!adminId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const { action } = body
  const service = await createServiceClient()

  try {
    switch (action) {
      case 'createExam': {
        const { name, body: examBody, description, is_public } = body
        if (!name?.trim()) return NextResponse.json({ error: 'Missing exam name' }, { status: 400 })
        const { data: exam, error } = await service.from('exams').insert({
          name: name.trim(),
          body: examBody?.trim() || null,
          description: description?.trim() || null,
          is_public: !!is_public,
          created_by: adminId,
          config: {},
        }).select('id').single()
        if (error) throw error
        return NextResponse.json({ ok: true, examId: exam.id })
      }
      case 'addSection': {
        const { examId, name, kind } = body
        if (!examId || !name?.trim()) return NextResponse.json({ error: 'Missing examId/name' }, { status: 400 })
        const k = ['mcq_study', 'aptitude', 'written'].includes(kind) ? kind : 'mcq_study'
        const { data: last } = await service.from('exam_sections').select('sort_order').eq('exam_id', examId).order('sort_order', { ascending: false }).limit(1).maybeSingle()
        const { error } = await service.from('exam_sections').insert({ exam_id: examId, name: name.trim(), kind: k, sort_order: (last?.sort_order ?? 0) + 1 })
        if (error) throw error
        return NextResponse.json({ ok: true })
      }
      case 'updateSection': {
        const { sectionId, fields } = body
        if (!sectionId || !fields) return NextResponse.json({ error: 'Missing sectionId/fields' }, { status: 400 })
        const allowed: Record<string, unknown> = {}
        if (typeof fields.name === 'string' && fields.name.trim()) allowed.name = fields.name.trim()
        if (['mcq_study', 'aptitude', 'written'].includes(fields.kind)) allowed.kind = fields.kind
        if (Object.keys(allowed).length === 0) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
        const { error } = await service.from('exam_sections').update(allowed).eq('id', sectionId)
        if (error) throw error
        return NextResponse.json({ ok: true })
      }
      case 'deleteSection': {
        const { sectionId } = body
        if (!sectionId) return NextResponse.json({ error: 'Missing sectionId' }, { status: 400 })
        // topics.section_id is SET NULL on section delete — remove the section's topics
        // explicitly first (their notes/subtopics cascade) to avoid orphaning them.
        await service.from('topics').delete().eq('section_id', sectionId)
        const { error } = await service.from('exam_sections').delete().eq('id', sectionId)
        if (error) throw error
        return NextResponse.json({ ok: true })
      }
      case 'updateExam': {
        const { examId, fields } = body
        if (!examId || !fields) return NextResponse.json({ error: 'Missing examId/fields' }, { status: 400 })
        const allowed: Record<string, unknown> = {}
        for (const k of ['name', 'body', 'description', 'is_public']) if (k in fields) allowed[k] = fields[k]
        const { error } = await service.from('exams').update(allowed).eq('id', examId)
        if (error) throw error
        return NextResponse.json({ ok: true })
      }
      case 'deleteExam': {
        const { examId } = body
        if (!examId) return NextResponse.json({ error: 'Missing examId' }, { status: 400 })
        // Detach any exams cloned from this one (cloned_from FK is NO ACTION, not cascade).
        await service.from('exams').update({ cloned_from: null }).eq('cloned_from', examId)
        // Deleting the exam cascades to its sections, topics, MCQs and enrolments.
        const { error } = await service.from('exams').delete().eq('id', examId)
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
        const { examId, name, paper, section, topic_number, sectionId, subtopics } = body
        if (!examId || !name?.trim() || !topic_number?.trim()) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
        if (!sectionId) return NextResponse.json({ error: 'Pick a section so the topic is visible to users' }, { status: 400 })
        const subNames = String(subtopics ?? '').split('\n').map(s => s.trim().replace(/^[-*\d.)\s]+/, '').trim()).filter(Boolean)
        const { data: topic, error } = await service.from('topics').insert({
          exam_id: examId, section_id: sectionId, name: name.trim(), paper: paper ?? 2, section: section ?? 'B',
          topic_number: String(topic_number).trim(), ai_priority: 5,
        }).select('id').single()
        if (error) throw error
        if (topic && subNames.length) {
          await service.from('subtopics').insert(subNames.map((n, i) => ({ topic_id: topic.id, name: n, sort_order: i })))
        }
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
        const [{ data: sources }, { data: legacy }] = await Promise.all([
          service.from('topic_source_files').select('language,content,file_name').eq('topic_id', topicId),
          service.from('topic_notes').select('official_source').eq('topic_id', topicId).maybeSingle(),
        ])
        const byLanguage: Record<string, { content: string; file_name: string | null }> = {}
        for (const row of sources ?? []) {
          if (isSourceLanguage(row.language)) byLanguage[row.language] = { content: row.content, file_name: row.file_name ?? null }
        }
        if (!byLanguage.en && legacy?.official_source?.trim()) {
          byLanguage.en = { content: legacy.official_source, file_name: 'legacy-official-source.md' }
        }
        return NextResponse.json({ sources: byLanguage, source: byLanguage.en?.content ?? '', legacySource: legacy?.official_source ?? '' })
      }
      case 'setTopicSource': {
        const { topicId, source, fileName } = body
        if (!topicId) return NextResponse.json({ error: 'Missing topicId' }, { status: 400 })
        const language = isSourceLanguage(body.language) ? body.language : 'en'
        const value = typeof source === 'string' ? source.trim() : ''
        const { error } = value
          ? await service.from('topic_source_files').upsert(
            {
              topic_id: topicId,
              language,
              content: value,
              file_name: typeof fileName === 'string' && fileName.trim() ? fileName.trim() : null,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'topic_id,language' },
          )
          : await service.from('topic_source_files').delete().eq('topic_id', topicId).eq('language', language)
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
