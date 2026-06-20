import { createClient } from '@/lib/supabase/server'
import { getActiveExam } from '@/lib/exam'
import { monthStartISO } from '@/lib/usage'
import { ProfileClient } from '@/components/profile/ProfileClient'

export default async function ProfilePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [{ data: profile }, active, { data: sessions }, { data: progress }, { count: topicTotal }, { data: usage }] = await Promise.all([
    supabase.from('profiles').select('full_name, role, created_at, token_allocation').eq('id', user!.id).maybeSingle(),
    getActiveExam(),
    supabase.from('sessions').select('duration_mins'),
    supabase.from('user_topic_progress').select('status'),
    supabase.from('topics').select('id', { count: 'exact', head: true }),
    supabase.from('ai_usage').select('total_tokens').gte('created_at', `${monthStartISO()}T00:00:00Z`),
  ])

  const totalMins = (sessions ?? []).reduce((s, r) => s + r.duration_mins, 0)
  const doneCount = (progress ?? []).filter(p => p.status === 'done').length
  const tokensUsed = (usage ?? []).reduce((s, r) => s + (r.total_tokens ?? 0), 0)
  const tokenAllocation = profile?.token_allocation && profile.token_allocation > 0 ? profile.token_allocation : null

  return (
    <ProfileClient
      name={profile?.full_name ?? user?.user_metadata?.full_name ?? ''}
      email={user?.email ?? ''}
      role={profile?.role ?? 'learner'}
      memberSince={profile?.created_at ?? null}
      examName={active?.exam.name ?? null}
      examBody={active?.exam.body ?? null}
      examDate={active?.examDate ?? null}
      sessionCount={sessions?.length ?? 0}
      totalHours={Math.round(totalMins / 60 * 10) / 10}
      topicsDone={doneCount}
      topicsTotal={topicTotal ?? 0}
      tokensUsed={tokensUsed}
      tokenAllocation={tokenAllocation}
    />
  )
}
