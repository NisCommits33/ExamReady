import { getAnalytics } from '@/lib/admin'
import { MiniBars, HBars } from '@/components/admin/MiniBars'
import { actionMeta } from '@/lib/activity-meta'

export const dynamic = 'force-dynamic'

const fmtTokens = (n: number) => n >= 1_000_000 ? `${(n / 1_000_000).toFixed(2)}M` : n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n)
const fmtCost = (n: number) => `$${n < 1 ? n.toFixed(4) : n.toFixed(2)}`

export default async function AdminAnalyticsPage() {
  const a = await getAnalytics(30)

  const totalSessions = a.days.reduce((s, d) => s + d.sessions, 0)
  const totalHours = Math.round(a.days.reduce((s, d) => s + d.hours, 0) * 10) / 10
  const peakActive = Math.max(0, ...a.days.map(d => d.activeUsers))

  const stats = [
    { label: 'AI events (30d)', value: String(a.totalActivity) },
    { label: 'Sessions (30d)', value: String(totalSessions) },
    { label: 'Hours (30d)', value: String(totalHours) },
    { label: 'Cache entries', value: String(a.cacheRows) },
  ]

  return (
    <div className="space-y-4">
      <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {stats.map(s => (
          <div key={s.label} className="bg-white dark:bg-[#161B22] border border-gray-200 dark:border-[#30363D] rounded-xl p-3.5">
            <p className="text-xl font-semibold text-gray-900 dark:text-gray-100 tabular-nums leading-none">{s.value}</p>
            <p className="text-[11px] text-gray-400 uppercase tracking-wide mt-1">{s.label}</p>
          </div>
        ))}
      </section>

      {/* Active users / sessions trend */}
      <section className="bg-white dark:bg-[#161B22] border border-gray-200 dark:border-[#30363D] rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Active users / day</p>
          <span className="text-xs text-gray-400">peak {peakActive}</span>
        </div>
        <MiniBars data={a.days.map(d => ({ label: d.date, value: d.activeUsers }))} />
        <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mt-5 mb-3">Sessions / day</p>
        <MiniBars data={a.days.map(d => ({ label: d.date, value: d.sessions }))} color="#0D9488" />
        <div className="flex justify-between text-[10px] text-gray-400 mt-1">
          <span>{a.days[0]?.date.slice(5)}</span>
          <span>{a.days[a.days.length - 1]?.date.slice(5)}</span>
        </div>
      </section>

      {/* AI action breakdown */}
      <section className="bg-white dark:bg-[#161B22] border border-gray-200 dark:border-[#30363D] rounded-xl p-4">
        <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">AI action breakdown (30d)</p>
        {a.actionBreakdown.length === 0 ? (
          <p className="text-xs text-gray-400">No activity in range.</p>
        ) : (
          <HBars data={a.actionBreakdown.map(x => ({ label: actionMeta(x.action).label, value: x.count }))} color="#7C3AED" />
        )}
      </section>

      {/* Cache + per-user AI */}
      <div className="grid sm:grid-cols-2 gap-4">
        <section className="bg-white dark:bg-[#161B22] border border-gray-200 dark:border-[#30363D] rounded-xl p-4">
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">AI cache</p>
          <div className="space-y-1.5 text-xs">
            {a.cacheByMode.map(c => (
              <div key={c.mode} className="flex justify-between"><span className="text-gray-600 dark:text-gray-400 capitalize">{c.mode} entries</span><span className="tabular-nums text-gray-500">{c.count}</span></div>
            ))}
            <div className="flex justify-between pt-1.5 border-t border-gray-100 dark:border-[#21262D]">
              <span className="text-gray-600 dark:text-gray-400">Simplify hit-rate</span>
              <span className="tabular-nums text-gray-500">{a.simplifyHitRate === null ? '—' : `${a.simplifyHitRate}%`}</span>
            </div>
          </div>
        </section>

        <section className="bg-white dark:bg-[#161B22] border border-gray-200 dark:border-[#30363D] rounded-xl p-4">
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">AI usage by user (30d)</p>
          {a.perUserAi.length === 0 ? (
            <p className="text-xs text-gray-400">No AI usage in range.</p>
          ) : (
            <HBars data={a.perUserAi.map(u => ({ label: u.name, value: u.aiActions }))} color="#185FA5" />
          )}
        </section>
      </div>

      {/* Token usage */}
      <section className="bg-white dark:bg-[#161B22] border border-gray-200 dark:border-[#30363D] rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Token usage (30d)</p>
          <span className="text-xs text-gray-400">{fmtTokens(a.tokens.total)} tokens · {fmtCost(a.tokens.cost)} est.</span>
        </div>
        {a.tokens.total === 0 ? (
          <p className="text-xs text-gray-400">No token usage recorded yet (tracking is forward-only).</p>
        ) : (
          <div className="grid sm:grid-cols-2 gap-5">
            <div>
              <p className="text-[11px] text-gray-400 uppercase tracking-wide mb-2">By model</p>
              <div className="space-y-1.5">
                {a.tokens.byModel.map(m => (
                  <div key={`${m.provider}:${m.model}`} className="flex items-center justify-between gap-2 text-xs">
                    <span className="text-gray-600 dark:text-gray-400 truncate">{m.model}</span>
                    <span className="tabular-nums text-gray-500 flex-shrink-0">{fmtTokens(m.tokens)} · {fmtCost(m.cost)}</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <p className="text-[11px] text-gray-400 uppercase tracking-wide mb-2">By user</p>
              <div className="space-y-1.5">
                {a.tokens.byUser.map(u => (
                  <div key={u.userId} className="flex items-center justify-between gap-2 text-xs">
                    <span className="text-gray-600 dark:text-gray-400 truncate">{u.name}</span>
                    <span className="tabular-nums text-gray-500 flex-shrink-0">{fmtTokens(u.tokens)} · {fmtCost(u.cost)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
