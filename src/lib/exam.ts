import { createClient } from '@/lib/supabase/server'
import type { Exam, ExamSection } from '@/types/database'

export interface ActiveExam {
  exam: Exam
  sections: ExamSection[]
  examDate: string | null
}

/**
 * Loads the current user's active enrollment → exam + sections.
 * Returns null if the user has no active enrollment (e.g. not onboarded yet).
 */
export async function getActiveExam(): Promise<ActiveExam | null> {
  const supabase = await createClient()
  const { data: enrollment } = await supabase
    .from('enrollments')
    .select('exam_date, exams(*)')
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!enrollment?.exams) return null
  const exam = (Array.isArray(enrollment.exams) ? enrollment.exams[0] : enrollment.exams) as Exam

  const { data: sections } = await supabase
    .from('exam_sections')
    .select('*')
    .eq('exam_id', exam.id)
    .order('sort_order')

  return {
    exam,
    sections: (sections ?? []) as ExamSection[],
    examDate: enrollment.exam_date ?? exam.config?.default_exam_date ?? null,
  }
}

/** Short prompt-ready description of the active exam for AI system prompts. */
export async function getExamPromptContext(): Promise<string> {
  const active = await getActiveExam()
  if (!active) return 'a competitive exam'
  const { name, body, description } = active.exam
  const parts = [name, body && `(${body})`, description && `— ${description}`].filter(Boolean)
  return parts.join(' ')
}

/** Resolve the exam context for a specific topic (used by topic-scoped AI routes). */
export async function getExamContextForTopic(topicId: string): Promise<string> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('topics')
    .select('exams(name, body, description)')
    .eq('id', topicId)
    .maybeSingle()
  const examRaw = (data as { exams?: unknown } | null)?.exams
  const exam = (Array.isArray(examRaw) ? examRaw[0] : examRaw) as { name: string; body: string | null; description: string | null } | null
  if (!exam) return getExamPromptContext()
  return [exam.name, exam.body && `(${exam.body})`, exam.description && `— ${exam.description}`].filter(Boolean).join(' ')
}
