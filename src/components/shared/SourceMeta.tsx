import { History } from 'lucide-react'
import { relativeDate } from '@/lib/utils'
import type { TopicNote } from '@/types/database'

const fmt = (d: string) =>
  new Date(d).toLocaleString('en-US', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })

/**
 * Change metadata shown at the bottom of the official-source tab so users can
 * see when the admin-maintained content was last updated.
 */
export function SourceMeta({ note }: { note: TopicNote }) {
  if (!note.updated_at) return null
  return (
    <div className="mt-8 pt-4 border-t border-gray-100 dark:border-[#21262D]">
      <div className="flex items-start gap-2 text-[11px] text-gray-400 dark:text-gray-500">
        <History size={13} className="mt-px flex-shrink-0" />
        <div className="space-y-0.5">
          <p>
            Content updated {relativeDate(note.updated_at)}
            <span className="text-gray-300 dark:text-gray-600"> · {fmt(note.updated_at)}</span>
          </p>
          {note.generated_at && (
            <p>
              AI material generated {relativeDate(note.generated_at)}
              {note.model_used && <span className="text-gray-300 dark:text-gray-600"> · {note.model_used}</span>}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
