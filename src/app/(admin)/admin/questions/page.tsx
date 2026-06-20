import { getExamsOverview, getAllTopicsBrief, getAllSubtopicsBrief } from '@/lib/admin'
import { McqBankClient } from '@/components/admin/McqBankClient'

export const dynamic = 'force-dynamic'

export default async function AdminQuestionsPage() {
  const [exams, topics, subtopics] = await Promise.all([
    getExamsOverview(),
    getAllTopicsBrief(),
    getAllSubtopicsBrief(),
  ])
  return <McqBankClient exams={exams} topics={topics} subtopics={subtopics} />
}
