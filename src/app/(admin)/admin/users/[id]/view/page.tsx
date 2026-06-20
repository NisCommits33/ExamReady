import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, Eye } from 'lucide-react'
import { getUserView } from '@/lib/admin'
import { relativeDate, formatDate } from '@/lib/utils'
import { cn } from '@/lib/utils'

export const dynamic = 'force-dynamic'

const STATUS_TINT: Record<string, string> = {
  done: 'bg-success-50 text-success-700 dark:bg-success-900/20 dark:text-success-400',
  in_progress: 'bg-warning-50 text-warning-700 dark:bg-warning-900/20 dark:text-warning-400',
  not_started: 'bg-gray-100 text-gray-500 dark:bg-[#1C2128] dark:text-gray-400',
}

export default async function AdminUserViewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const v = await getUserView(id)
  if (!v) notFound()

  return (
    <div>
      <Link href={`/admin/users/${id}`} className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 mb-4 transition-colors">
        <ArrowLeft size={14} /> Back to user
      </Link>

      <div className="mb-4 flex items-center gap-2 px-3 py-2 bg-amber-50 dark:bg-amber-900/15 border border-amber-200 dark:border-amber-900/40 rounded-lg">
        <Eye size={14} className="text-amber-600 dark:text-amber-400 flex-shrink-0" />
        <span className="text-xs text-amber-700 dark:text-amber-400">Read-only view of <strong>{v.name}</strong>&apos;s study data ({v.email})</span>
      </div>

      {/* Upcoming schedule */}
      <section className="bg-white dark:bg-[#161B22] border border-gray-200 dark:border-[#30363D] rounded-xl p-4 mb-4">
        <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">Upcoming planned sessions</p>
        {v.planned.length === 0 ? (
          <p className="text-xs text-gray-400">None scheduled.</p>
        ) : (
          <div className="space-y-2">
            {v.planned.map((p, i) => (
              <div key={i} className="flex items-center justify-between gap-3 text-xs">
                <span className="text-gray-700 dark:text-gray-300 truncate">{p.topic ?? p.session_type}</span>
                <span className="text-gray-400 flex-shrink-0">{p.session_type} · {p.duration_mins}m · {formatDate(p.scheduled_date)}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Topic progress */}
      <section className="bg-white dark:bg-[#161B22] border border-gray-200 dark:border-[#30363D] rounded-xl p-4">
        <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">Topic progress ({v.progress.length})</p>
        {v.progress.length === 0 ? (
          <p className="text-xs text-gray-400">No topic progress yet.</p>
        ) : (
          <div className="space-y-1.5">
            {v.progress.map((t, i) => (
              <div key={i} className="flex items-center justify-between gap-3">
                <span className="text-sm text-gray-700 dark:text-gray-300 truncate">
                  {t.name}
                  {t.paper ? <span className="text-gray-400 text-xs"> · P{t.paper}{t.section}</span> : null}
                </span>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {t.last_studied && <span className="text-[11px] text-gray-400">{relativeDate(t.last_studied)}</span>}
                  <span className={cn('text-[10px] font-medium px-2 py-0.5 rounded-full capitalize', STATUS_TINT[t.status] ?? STATUS_TINT.not_started)}>
                    {t.status.replace('_', ' ')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
