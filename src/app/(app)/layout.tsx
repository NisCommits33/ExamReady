import { Shell } from '@/components/layout/Shell'
import { createClient } from '@/lib/supabase/server'
import { getActiveExam } from '@/lib/exam'
import { redirect } from 'next/navigation'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('onboarded').eq('id', user.id).maybeSingle()
  if (!profile?.onboarded) redirect('/onboarding')

  const active = await getActiveExam()
  const sections = (active?.sections ?? []).map(s => ({ id: s.id, name: s.name, kind: s.kind }))

  return <Shell examName={active?.exam.name ?? 'ExamReady'} sections={sections}>{children}</Shell>
}
