import { NextResponse } from 'next/server'
import { assertSuperAdmin } from '@/lib/admin'
import { createServiceClient } from '@/lib/supabase/server'
import { parseMcqInput } from '@/lib/mcq'

export async function POST(req: Request) {
  const adminId = await assertSuperAdmin()
  if (!adminId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const { action } = body
  const service = await createServiceClient()

  try {
    switch (action) {
      case 'list': {
        const { topicId } = body
        if (!topicId) return NextResponse.json({ error: 'Missing topicId' }, { status: 400 })
        const { data } = await service
          .from('mcq_questions')
          .select('id,question,correct,difficulty,subtopic_id,created_at')
          .eq('topic_id', topicId)
          .order('created_at', { ascending: false })
        return NextResponse.json({ questions: data ?? [] })
      }
      case 'import': {
        const { topicId, subtopicId, text, format } = body
        if (!topicId) return NextResponse.json({ error: 'Pick a topic' }, { status: 400 })
        const { rows, errors } = parseMcqInput(String(text ?? ''), format === 'csv' ? 'csv' : 'json')
        if (rows.length === 0) return NextResponse.json({ error: errors[0] ?? 'No valid questions found', errors }, { status: 400 })

        // Resolve exam_id / section_id from the chosen topic.
        const { data: topic } = await service.from('topics').select('exam_id,section_id').eq('id', topicId).maybeSingle()

        const { error } = await service.from('mcq_questions').insert(
          rows.map(r => ({
            exam_id: topic?.exam_id ?? null,
            section_id: topic?.section_id ?? null,
            topic_id: topicId,
            subtopic_id: subtopicId ?? null,
            question: r.question,
            options: r.options,
            correct: r.correct,
            explanation: r.explanation || null,
            difficulty: r.difficulty,
          })),
        )
        if (error) throw error
        return NextResponse.json({ ok: true, imported: rows.length, skipped: errors.length, errors })
      }
      case 'insertMany': {
        const { topicId, subtopicId, questions, difficulty } = body
        if (!topicId) return NextResponse.json({ error: 'Missing topicId' }, { status: 400 })
        if (!Array.isArray(questions) || questions.length === 0) return NextResponse.json({ error: 'No questions' }, { status: 400 })
        const { data: topic } = await service.from('topics').select('exam_id,section_id').eq('id', topicId).maybeSingle()
        const fallbackDiff = ['easy', 'medium', 'hard'].includes(difficulty) ? difficulty : 'medium'
        const rows = []
        for (const q of questions as Record<string, unknown>[]) {
          const opt = (q.options ?? {}) as Record<string, unknown>
          const options = { A: String(opt.A ?? '').trim(), B: String(opt.B ?? '').trim(), C: String(opt.C ?? '').trim(), D: String(opt.D ?? '').trim() }
          const correct = String(q.correct ?? '').trim().toUpperCase()
          const question = String(q.question ?? '').trim()
          if (!question || !options.A || !options.B || !options.C || !options.D || !['A', 'B', 'C', 'D'].includes(correct)) continue
          const diff = ['easy', 'medium', 'hard'].includes(String(q.difficulty)) ? String(q.difficulty) : fallbackDiff
          rows.push({
            exam_id: topic?.exam_id ?? null, section_id: topic?.section_id ?? null, topic_id: topicId, subtopic_id: subtopicId ?? null,
            question, options, correct, explanation: String(q.explanation ?? '').trim() || null, difficulty: diff, source: 'ai',
          })
        }
        if (rows.length === 0) return NextResponse.json({ error: 'No valid questions to save' }, { status: 400 })
        const { error } = await service.from('mcq_questions').insert(rows)
        if (error) throw error
        return NextResponse.json({ ok: true, inserted: rows.length })
      }
      case 'delete': {
        const { id } = body
        if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })
        const { error } = await service.from('mcq_questions').delete().eq('id', id)
        if (error) throw error
        return NextResponse.json({ ok: true })
      }
      case 'deleteMany': {
        const { ids } = body
        if (!Array.isArray(ids) || ids.length === 0) return NextResponse.json({ error: 'No questions selected' }, { status: 400 })
        const { error } = await service.from('mcq_questions').delete().in('id', ids)
        if (error) throw error
        return NextResponse.json({ ok: true, deleted: ids.length })
      }
      case 'deleteAll': {
        const { topicId } = body
        if (!topicId) return NextResponse.json({ error: 'Missing topicId' }, { status: 400 })
        const { error } = await service.from('mcq_questions').delete().eq('topic_id', topicId)
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
