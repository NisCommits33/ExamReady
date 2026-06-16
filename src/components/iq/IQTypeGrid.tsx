import { cn } from '@/lib/utils'
import { IQ_QUESTION_TYPES, CATEGORY_COLORS } from '@/lib/constants'
import type { IQStats, IQType } from '@/types/database'

interface IQTypeGridProps {
  stats: IQStats[]
  onSelectType: (type: IQType | 'random') => void
}

export function IQTypeGrid({ stats, onSelectType }: IQTypeGridProps) {
  const statsMap = Object.fromEntries(stats.map(s => [s.type, s]))

  return (
    <div className="grid grid-cols-2 gap-2.5">
      {IQ_QUESTION_TYPES.map(t => {
        const stat = statsMap[t.id]
        const pct = stat?.accuracy_pct ?? 0
        const attempted = stat?.total_attempted ?? 0
        const weak = attempted > 0 && pct < 50
        const colors = CATEGORY_COLORS[t.category as keyof typeof CATEGORY_COLORS]
        const barColor = pct >= 70 ? 'bg-success-400' : pct >= 50 ? 'bg-warning-400' : 'bg-danger-400'

        return (
          <button
            key={t.id}
            onClick={() => onSelectType(t.id as IQType)}
            className={cn(
              'bg-white dark:bg-[#161B22] border rounded-xl p-3.5 text-left transition-all duration-150 hover:shadow-sm active:scale-[0.98]',
              weak ? 'border-warning-400' : 'border-gray-200 dark:border-[#30363D]'
            )}
          >
            <div className="flex items-center justify-between mb-2">
              <span className={cn('text-[11px] font-medium px-1.5 py-0.5 rounded-full', colors.bg, colors.text)}>
                {t.category === 'non_verbal' ? 'Non-verbal' : t.category.charAt(0).toUpperCase() + t.category.slice(1)}
              </span>
              {weak && <span className="text-[10px] font-semibold text-warning-400">Weak · drill</span>}
            </div>
            <p className="text-xs font-medium text-gray-900 dark:text-gray-100 mb-2 leading-snug">{t.label}</p>
            {attempted > 0 ? (
              <div>
                <div className="h-1 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden mb-1">
                  <div className={cn('h-full rounded-full transition-all', barColor)} style={{ width: `${pct}%` }} />
                </div>
                <p className="text-[11px] text-gray-400 dark:text-gray-500">{Math.round(pct)}% · {attempted} done</p>
              </div>
            ) : (
              <p className="text-[11px] text-gray-400 dark:text-gray-600">Not started</p>
            )}
          </button>
        )
      })}
    </div>
  )
}
