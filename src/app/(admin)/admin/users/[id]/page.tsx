import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, Eye } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getUserDetail } from '@/lib/admin'
import { AdminActivityFeed } from '@/components/admin/AdminActivityFeed'
import { AdminUserActions } from '@/components/admin/AdminUserActions'
import { HBars, MiniBars } from '@/components/admin/MiniBars'
import { actionMeta } from '@/lib/activity-meta'
import { relativeDate, formatDuration, formatDate } from '@/lib/utils'

export const dynamic = 'force-dynamic'

const fmtTokens = (n: number) => n >= 1_000_000 ? `${(n / 1_000_000).toFixed(2)}M` : n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n)
const fmtCost = (n: number) => `$${n < 1 ? n.toFixed(4) : n.toFixed(2)}`

export default async function AdminUserPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [user, supabase] = await Promise.all([getUserDetail(id), createClient()])
  if (!user) notFound()
  const { data: { user: me } } = await supabase.auth.getUser()
  const isSelf = me?.id === id

  const stats = [
    { label: 'Sessions', value: String(user.sessions) },
    { label: 'Hours', value: String(user.hours) },
    { label: 'Streak', value: `${user.streak}d` },
    { label: 'Topics done', value: `${user.topicsDone}/${user.topicsTotal}` },
    { label: 'IQ accuracy', value: user.iqAccuracy === null ? '—' : `${user.iqAccuracy}%` },
    { label: 'Drill avg', value: user.drillAvg === null ? '—' : `${user.drillAvg}%` },
    { label: 'P2 answers', value: String(user.p2Count) },
    { label: 'Flagged', value: String(user.topicsFlagged) },
    { label: 'Tokens', value: fmtTokens(user.tokensTotal) },
    { label: 'Est. cost', value: fmtCost(user.tokenCost) },
  ]

  return (
    <div>
      <Link href="/admin/users" className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 mb-4 transition-colors">
        <ArrowLeft size={14} /> Back to users
      </Link>

      {/* Identity */}
      <section className="bg-white dark:bg-[#161B22] border border-gray-200 dark:border-[#30363D] rounded-xl p-5 mb-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 truncate">{user.name}</h2>
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-400 capitalize">{user.role}</span>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 truncate mt-0.5">{user.email}</p>
            <p className="text-[11px] text-gray-400 mt-1">
              Joined {user.joined ? formatDate(user.joined) : '—'} · Last sign-in {relativeDate(user.lastSignIn)} · Last active {relativeDate(user.lastActive)}
            </p>
          </div>
          <Link
            href={`/admin/users/${id}/view`}
            className="flex-shrink-0 inline-flex items-center gap-1.5 text-xs font-medium text-brand-600 border border-brand-200 dark:border-brand-800 px-3 py-1.5 rounded-lg hover:bg-brand-50 dark:hover:bg-brand-900/20 transition-colors"
          >
            <Eye size={13} /> View as
          </Link>
        </div>
      </section>

      {/* Stats */}
      <section className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        {stats.map(s => (
          <div key={s.label} className="bg-white dark:bg-[#161B22] border border-gray-200 dark:border-[#30363D] rounded-xl p-3.5">
            <p className="text-xl font-semibold text-gray-900 dark:text-gray-100 tabular-nums leading-none">{s.value}</p>
            <p className="text-[11px] text-gray-400 uppercase tracking-wide mt-1">{s.label}</p>
          </div>
        ))}
      </section>

      {user.tokensByProvider.length > 0 && (
        <p className="text-[11px] text-gray-400 mb-4 -mt-1">
          Tokens by provider: {user.tokensByProvider.map(p => `${p.provider} ${fmtTokens(p.tokens)}`).join(' · ')}
        </p>
      )}

      <AdminUserActions userId={id} currentRole={user.role} isSelf={isSelf} enrollmentActive={user.enrollmentActive} tokenAllocation={user.tokenReport.allocation} />

      {/* Token consumption */}
      <section className="bg-white dark:bg-[#161B22] border border-gray-200 dark:border-[#30363D] rounded-xl p-5 mb-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Token consumption (this month)</p>
          <span className="text-xs text-gray-400">{fmtCost(user.tokenReport.monthCost)} est.</span>
        </div>

        {user.tokenReport.allocation === null ? (
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
            <span className="tabular-nums font-medium text-gray-900 dark:text-gray-100">{fmtTokens(user.tokenReport.monthUsed)}</span> tokens used · <span className="text-gray-400">Unlimited allocation</span>
          </p>
        ) : (
          <>
            <div className="flex items-baseline justify-between mb-1.5">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                <span className="tabular-nums font-medium text-gray-900 dark:text-gray-100">{fmtTokens(user.tokenReport.monthUsed)}</span>
                {' / '}{fmtTokens(user.tokenReport.allocation)} tokens
              </p>
              <span className="text-xs text-gray-400 tabular-nums">{user.tokenReport.pctUsed}% · {fmtTokens(user.tokenReport.monthRemaining ?? 0)} left</span>
            </div>
            <div className="w-full h-2 bg-gray-100 dark:bg-[#1C2128] rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${(user.tokenReport.pctUsed ?? 0) >= 100 ? 'bg-red-500' : (user.tokenReport.pctUsed ?? 0) >= 80 ? 'bg-amber-500' : 'bg-brand-500'}`}
                style={{ width: `${user.tokenReport.pctUsed ?? 0}%` }}
              />
            </div>
          </>
        )}

        {user.tokenReport.monthUsed > 0 && (
          <>
            <div className="grid sm:grid-cols-2 gap-5 mt-5">
              <div>
                <p className="text-[11px] text-gray-400 uppercase tracking-wide mb-2">By feature</p>
                <HBars data={user.tokenReport.byAction.map(x => ({ label: actionMeta(x.action).label, value: x.tokens }))} color="#7C3AED" />
              </div>
              <div>
                <p className="text-[11px] text-gray-400 uppercase tracking-wide mb-2">By model</p>
                <HBars data={user.tokenReport.byModel.map(m => ({ label: m.model, value: m.tokens }))} color="#0D9488" />
              </div>
            </div>

            {user.tokenReport.byDay.length > 1 && (
              <div className="mt-5">
                <p className="text-[11px] text-gray-400 uppercase tracking-wide mb-2">Tokens / day</p>
                <MiniBars data={user.tokenReport.byDay.map(d => ({ label: d.date, value: d.tokens }))} />
              </div>
            )}

            <div className="mt-5">
              <p className="text-[11px] text-gray-400 uppercase tracking-wide mb-2">Recent calls</p>
              <div className="space-y-1.5">
                {user.tokenReport.recentCalls.map((c, i) => (
                  <div key={i} className="flex items-center justify-between gap-3 text-xs">
                    <span className="text-gray-700 dark:text-gray-300 truncate">{actionMeta(c.action).label}</span>
                    <span className="text-gray-400 flex-shrink-0 tabular-nums">{fmtTokens(c.total_tokens)} · {relativeDate(c.created_at)}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </section>

      {/* Flagged topics */}
      {user.flaggedTopics.length > 0 && (
        <section className="bg-white dark:bg-[#161B22] border border-gray-200 dark:border-[#30363D] rounded-xl p-4 mb-4">
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">Flagged topics</p>
          <div className="flex flex-wrap gap-1.5">
            {user.flaggedTopics.map((t, i) => (
              <span key={i} className="text-xs px-2 py-1 rounded-md bg-amber-50 dark:bg-amber-900/15 text-amber-700 dark:text-amber-400">{t}</span>
            ))}
          </div>
        </section>
      )}

      {/* Paper 2 answers */}
      {user.recentP2.length > 0 && (
        <section className="bg-white dark:bg-[#161B22] border border-gray-200 dark:border-[#30363D] rounded-xl p-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Paper 2 answers</p>
            {user.p2AvgScore !== null && <span className="text-xs text-gray-400">avg {user.p2AvgScore}</span>}
          </div>
          <div className="space-y-2">
            {user.recentP2.map((a, i) => (
              <div key={i} className="flex items-center justify-between gap-3 text-xs">
                <span className="text-gray-700 dark:text-gray-300">{a.question_type}</span>
                <span className="text-gray-400 flex-shrink-0">
                  {a.ai_score === null ? 'ungraded' : `${a.ai_score}`} · {formatDate(a.attempted_at)}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Recent sessions */}
      {user.recentSessions.length > 0 && (
        <section className="bg-white dark:bg-[#161B22] border border-gray-200 dark:border-[#30363D] rounded-xl p-4 mb-4">
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">Logged sessions</p>
          <div className="space-y-2">
            {user.recentSessions.map((s, i) => (
              <div key={i} className="flex items-center justify-between gap-3 text-xs">
                <span className="text-gray-700 dark:text-gray-300 truncate">{s.topic ?? 'Session'}</span>
                <span className="text-gray-400 flex-shrink-0">{formatDuration(s.duration_mins)} · {formatDate(s.date)}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      <AdminActivityFeed items={user.recentActivity} title="Activity history" />
    </div>
  )
}
