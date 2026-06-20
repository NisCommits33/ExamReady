import { getExamsOverview, getShiftTypes, getAllTopicsBrief, getSectionsBrief } from '@/lib/admin'
import { AdminContentClient } from '@/components/admin/AdminContentClient'

export const dynamic = 'force-dynamic'

export default async function AdminContentPage() {
  const [exams, shiftTypes, topics, sections] = await Promise.all([
    getExamsOverview(),
    getShiftTypes(),
    getAllTopicsBrief(),
    getSectionsBrief(),
  ])
  return <AdminContentClient exams={exams} shiftTypes={shiftTypes} topics={topics} sections={sections} />
}
