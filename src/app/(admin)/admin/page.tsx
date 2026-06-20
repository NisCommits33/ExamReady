import Link from 'next/link'
import { Users, Flame, Clock, Sparkles, Hash, DollarSign, ArrowRight } from 'lucide-react'
import { getUsersOverview, getGlobalActivity, getAnalytics } from '@/lib/admin'
import { StatCard } from '@/components/admin/StatCard'
import { MiniBars } from '@/components/admin/MiniBars'
import { GlobalActivityExplorer } from '@/components/admin/GlobalActivityExplorer'
import { fmtTokens, fmtCost } from '@/lib/format'

export const dynamic = 'force-dynamic'

export default async function AdminDashboardPage() {
  const [users, activity, analytics] = await Promise.all([
    getUsersOverview(),
    getGlobalActivity(200),
    getAnalytics(30),
  ])

  const totalSessions = users.reduce((s, u) => s + u.sessions, 0)
  const totalHours = Math.round(users.reduce((s, u) => s + u.hours, 0) * 10) / 10
  const topTokenUsers = [...users].filter(u => u.tokens > 0).sort((a, b) => b.tokens - a.tokens).slice(0, 6)

  return (
    <div className="space-y-5">
      {/* KPI cards */}
      <section className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        <StatCard label="Users" value={String(users.length)} Icon={Users} />
        <StatCard label="Sessions" value={String(totalSessions)} Icon={Flame} tint="text-brand-500" />
        <StatCard label="Hours" value={String(totalHours)} Icon={Clock} tint="text-teal-500" />
        <StatCard label="AI events (30d)" value={String(analytics.totalActivity)} Icon={Sparkles} tint="text-purple-500" />
        <StatCard label="Tokens (30d)" value={fmtTokens(analytics.tokens.total)} Icon={Hash} tint="text-teal-500" />
        <StatCard label="Cost (30d)" value={fmtCost(analytics.tokens.cost)} Icon={DollarSign} tint="text-success-500" />
      </section>

      <div className="grid lg:grid-cols-3 gap-4">
        {/* Trends */}
        <section className="lg:col-span-2 bg-white dark:bg-[#161B22] border border-gray-200 dark:border-[#30363D] rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Activity — last 30 days</p>
            <Link href="/admin/analytics" className="text-xs font-medium text-brand-600 hover:text-brand-800 inline-flex items-center gap-1">
              Analytics <ArrowRight size={12} />
            </Link>
          </div>
          <p className="text-[11px] text-gray-400 uppercase tracking-wide mb-1.5">Active users / day</p>
          <MiniBars data={analytics.days.map(d => ({ label: d.date, value: d.activeUsers }))} />
          <p className="text-[11px] text-gray-400 uppercase tracking-wide mb-1.5 mt-4">Sessions / day</p>
          <MiniBars data={analytics.days.map(d => ({ label: d.date, value: d.sessions }))} color="#0D9488" />
        </section>

        {/* Top token users */}
        <section className="bg-white dark:bg-[#161B22] border border-gray-200 dark:border-[#30363D] rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Top token users</p>
            <Link href="/admin/users" className="text-xs font-medium text-brand-600 hover:text-brand-800 inline-flex items-center gap-1">
              All <ArrowRight size={12} />
            </Link>
          </div>
          {topTokenUsers.length === 0 ? (
            <p className="text-xs text-gray-400 py-4 text-center">No token usage recorded yet.</p>
          ) : (
            <div className="space-y-1">
              {topTokenUsers.map(u => (
                <Link key={u.id} href={`/admin/users/${u.id}`} className="flex items-center justify-between gap-3 px-2 py-1.5 -mx-2 rounded-lg hover:bg-gray-50 dark:hover:bg-[#1C2128] transition-colors">
                  <span className="text-sm text-gray-700 dark:text-gray-300 truncate">{u.name}</span>
                  <span className="text-xs tabular-nums text-gray-500 flex-shrink-0">{fmtTokens(u.tokens)}</span>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Activity log */}
      <GlobalActivityExplorer items={activity} users={users} />
    </div>
  )
}
