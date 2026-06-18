import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { OnboardingWizard } from '@/components/onboarding/OnboardingWizard'

export default async function OnboardingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('onboarded, full_name').eq('id', user.id).maybeSingle()
  if (profile?.onboarded) redirect('/')

  const { data: catalog } = await supabase
    .from('exams')
    .select('id, name, body, description')
    .eq('is_public', true)
    .order('created_at')

  return (
    <div className="min-h-dvh bg-gray-100 dark:bg-[#0D1117] flex items-start md:items-center justify-center p-4">
      <div className="w-full max-w-md">
        <OnboardingWizard
          defaultName={profile?.full_name ?? user.user_metadata?.full_name ?? ''}
          catalog={catalog ?? []}
        />
      </div>
    </div>
  )
}
