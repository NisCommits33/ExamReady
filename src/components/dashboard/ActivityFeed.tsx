import { relativeDate } from '@/lib/utils'
import { actionMeta } from '@/lib/activity-meta'
import type { ActivityLog } from '@/types/database'

export function ActivityFeed({ activities }: { activities: ActivityLog[] }) {
  if (activities.length === 0) return null

  return (
    <div className="bg-white dark:bg-[#161B22] border border-gray-200 dark:border-[#30363D] rounded-xl p-4">
      <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">Recent activity</p>
      <div className="space-y-2.5">
        {activities.slice(0, 6).map(a => {
          const meta = actionMeta(a.action)
          const topicName = (a.meta as { topic?: string })?.topic
          return (
            <div key={a.id} className="flex items-center gap-3">
              <meta.Icon size={14} className={`${meta.color} flex-shrink-0`} />
              <p className="text-xs text-gray-700 dark:text-gray-300 flex-1 truncate">
                {meta.label}
                {topicName && <span className="text-gray-400"> · {topicName}</span>}
              </p>
              <span className="text-[11px] text-gray-400 flex-shrink-0">{relativeDate(a.created_at)}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
