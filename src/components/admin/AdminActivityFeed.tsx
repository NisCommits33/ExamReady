import { relativeDate } from '@/lib/utils'
import { actionMeta } from '@/lib/activity-meta'
import type { AdminActivityItem } from '@/lib/admin'

export function AdminActivityFeed({ items, title = 'Recent activity' }: { items: AdminActivityItem[]; title?: string }) {
  return (
    <div className="bg-white dark:bg-[#161B22] border border-gray-200 dark:border-[#30363D] rounded-xl p-4">
      <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">{title}</p>
      {items.length === 0 ? (
        <p className="text-xs text-gray-400 py-4 text-center">No activity yet</p>
      ) : (
        <div className="space-y-2.5">
          {items.map(a => {
            const meta = actionMeta(a.action)
            return (
              <div key={a.id} className="flex items-center gap-3">
                <meta.Icon size={14} className={`${meta.color} flex-shrink-0`} />
                <p className="text-xs text-gray-700 dark:text-gray-300 flex-1 truncate">
                  <span className="font-medium text-gray-900 dark:text-gray-100">{a.userName}</span>
                  <span className="text-gray-400"> · </span>
                  {meta.label}
                  {a.topic && <span className="text-gray-400"> · {a.topic}</span>}
                </p>
                <span className="text-[11px] text-gray-400 flex-shrink-0">{relativeDate(a.created_at)}</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
