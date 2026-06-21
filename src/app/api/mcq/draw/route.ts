import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { shuffleQuestion, type DrillQuestion } from '@/lib/mcq'

export async function POST(req: Request) {
  // Any signed-in user may draw practice questions.
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { topicId, sectionId, subtopicId, difficulty, count } = await req.json()
  const n = Math.min(50, Math.max(1, Number(count) || 5))

  const service = await createServiceClient()
  let q = service.from('mcq_questions').select('id')
  if (topicId) q = q.eq('topic_id', topicId)
  else if (sectionId) q = q.eq('section_id', sectionId)
  else return NextResponse.json({ error: 'Missing topicId or sectionId' }, { status: 400 })
  if (subtopicId) q = q.eq('subtopic_id', subtopicId)
  if (['easy', 'medium', 'hard'].includes(difficulty)) q = q.eq('difficulty', difficulty)

  const { data: ids, error } = await q
  if (error) return NextResponse.json({ error: String(error.message) }, { status: 500 })

  // Shuffle ids and take up to n, then fetch the full rows.
  const picked = [...(ids ?? [])].sort(() => Math.random() - 0.5).slice(0, n).map(r => r.id)
  if (picked.length === 0) return NextResponse.json({ questions: [] })

  const { data: rows } = await service
    .from('mcq_questions')
    .select('question,options,correct,explanation')
    .in('id', picked)

  const questions: DrillQuestion[] = (rows ?? [])
    .sort(() => Math.random() - 0.5)
    .map(r => shuffleQuestion({
      question: r.question,
      options: (r.options ?? {}) as Record<string, string>,
      correct: r.correct,
      explanation: r.explanation ?? '',
      trap: '',
    }))

  return NextResponse.json({ questions })
}
