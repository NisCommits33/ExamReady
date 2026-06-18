import { createClient } from '@/lib/supabase/server'
import { getActiveExam } from '@/lib/exam'
import { ProfileClient } from '@/components/profile/ProfileClient'

export default async function ProfilePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [{ data: profile }, active, { data: sessions }, { data: progress }, { count: topicTotal }] = await Promise.all([
    supabase.from('profiles').select('full_name, role, created_at').eq('id', user!.id).maybeSingle(),
    getActiveExam(),
    supabase.from('sessions').select('duration_mins'),
    supabase.from('user_topic_progress').select('status'),
    supabase.from('topics').select('id', { count: 'exact', head: true }),
  ])

  const totalMins = (sessions ?? []).reduce((s, r) => s + r.duration_mins, 0)
  const doneCount = (progress ?? []).filter(p => p.status === 'done').length

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
    />
  )
}
