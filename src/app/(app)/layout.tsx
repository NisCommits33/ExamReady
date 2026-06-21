import { Shell } from '@/components/layout/Shell'
import { createClient } from '@/lib/supabase/server'
import { getActiveExam } from '@/lib/exam'
import { redirect } from 'next/navigation'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('onboarded, role').eq('id', user.id).maybeSingle()
  const isSuperAdmin = profile?.role === 'super_admin'
  // Super admins are not students — they skip the exam onboarding wizard entirely.
  if (!profile?.onboarded && !isSuperAdmin) redirect('/onboarding')

  const active = await getActiveExam()
  const sections = (active?.sections ?? []).map(s => ({ id: s.id, name: s.name, kind: s.kind }))

  const { data: announcements } = await supabase
    .from('announcements')
    .select('id,message,level')
    .eq('active', true)
    .order('created_at', { ascending: false })

  return (
    <Shell examName={active?.exam.name ?? 'LOKAI'} sections={sections} isSuperAdmin={isSuperAdmin} announcements={announcements ?? []}>
      {children}
    </Shell>
  )
}
