import { redirect } from 'next/navigation'
import { getActiveExam } from '@/lib/exam'

export default async function GKRedirect() {
  const active = await getActiveExam()
  const sec = active?.sections.find(s => s.kind === 'mcq_study')
  redirect(sec ? `/s/${sec.id}` : '/')
}
