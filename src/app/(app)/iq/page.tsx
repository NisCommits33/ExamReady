import { redirect } from 'next/navigation'
import { getActiveExam } from '@/lib/exam'

export default async function IQRedirect() {
  const active = await getActiveExam()
  const sec = active?.sections.find(s => s.kind === 'aptitude')
  redirect(sec ? `/s/${sec.id}` : '/')
}
