import { cn } from '@/lib/utils'
import { IQ_QUESTION_TYPES, CATEGORY_COLORS } from '@/lib/constants'
import type { IQStats, IQType, IQCategory } from '@/types/database'

interface IQTypeGridProps {
  stats: IQStats[]
  onSelectType: (type: IQType | 'random') => void
}

const CATEGORY_ORDER: { id: IQCategory; label: string }[] = [
  { id: 'verbal', label: 'Verbal reasoning' },
  { id: 'non_verbal', label: 'Non-verbal reasoning' },
  { id: 'arithmetic', label: 'Arithmetic' },
]

export function IQTypeGrid({ stats, onSelectType }: IQTypeGridProps) {
  const statsMap = Object.fromEntries(stats.map(s => [s.type, s]))

  return (
    <div className="space-y-5">
      {CATEGORY_ORDER.map(cat => {
        const types = IQ_QUESTION_TYPES.filter(t => t.category === cat.id)
        if (types.length === 0) return null
        const colors = CATEGORY_COLORS[cat.id]
        // Category-level accuracy across attempted types.
        const attemptedStats = types.map(t => statsMap[t.id]).filter(s => s && s.total_attempted > 0)
        const catPct = attemptedStats.length
          ? Math.round(attemptedStats.reduce((s, x) => s + x.accuracy_pct, 0) / attemptedStats.length)
          : null

        return (
          <div key={cat.id}>
            <div className="flex items-center justify-between mb-2">
              <span className={cn('text-[11px] font-semibold px-2 py-0.5 rounded-full', colors.bg, colors.text)}>{cat.label}</span>
              {catPct !== null && <span className="text-[11px] text-gray-400 tabular-nums">{catPct}% avg</span>}
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              {types.map(t => {
                const stat = statsMap[t.id]
                const pct = Math.round(stat?.accuracy_pct ?? 0)
                const attempted = stat?.total_attempted ?? 0
                const weak = attempted > 0 && pct < 50
                const barColor = pct >= 70 ? 'bg-success-400' : pct >= 50 ? 'bg-warning-400' : 'bg-danger-400'

                return (
                  <button
                    key={t.id}
                    onClick={() => onSelectType(t.id as IQType)}
                    className={cn(
                      'group bg-white dark:bg-[#161B22] border rounded-xl p-3.5 text-left transition-all duration-150 hover:shadow-sm hover:border-brand-400 dark:hover:border-brand-700 active:scale-[0.98]',
                      weak ? 'border-warning-400' : 'border-gray-200 dark:border-[#30363D]'
                    )}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2 min-h-[32px]">
                      <p className="text-xs font-medium text-gray-900 dark:text-gray-100 leading-snug">{t.label}</p>
                      {weak && <span className="flex-shrink-0 text-[9px] font-semibold text-warning-500 uppercase tracking-wide">Weak</span>}
                    </div>
                    {attempted > 0 ? (
                      <div>
                        <div className="h-1 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden mb-1">
                          <div className={cn('h-full rounded-full transition-all', barColor)} style={{ width: `${pct}%` }} />
                        </div>
                        <p className="text-[11px] text-gray-400 dark:text-gray-500 tabular-nums">{pct}% · {attempted} done</p>
                      </div>
                    ) : (
                      <p className="text-[11px] text-gray-400 dark:text-gray-600 group-hover:text-brand-500 transition-colors">Start drilling →</p>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
