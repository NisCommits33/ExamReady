import { redirect } from 'next/navigation'
import { getActiveExam } from '@/lib/exam'

export default async function ARFFRedirect() {
  const active = await getActiveExam()
  const sec = active?.sections.find(s => s.kind === 'written')
  redirect(sec ? `/s/${sec.id}` : '/')
}
