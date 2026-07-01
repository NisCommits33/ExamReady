import Link from 'next/link'
import { Layers, ChevronRight } from 'lucide-react'

interface Props {
  dueCardCount: number
}

export function DailyReview({ dueCardCount }: Props) {
  if (dueCardCount === 0) return null

  return (
    <div className="bg-white dark:bg-[#161B22] border border-gray-200 dark:border-[#30363D] rounded-xl p-4">
      <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">Daily review</p>
      <div className="space-y-2">
        <Link href="/review" className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-teal-50 dark:bg-teal-900/15 hover:bg-teal-100 dark:hover:bg-teal-900/25 transition-colors">
          <Layers size={16} className="text-teal-500 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
              {dueCardCount > 0 ? `${dueCardCount} card${dueCardCount > 1 ? 's' : ''} due for review` : 'Review due cards'}
            </p>
            <p className="text-[11px] text-gray-400">Spaced repetition keeps facts fresh</p>
          </div>
          <ChevronRight size={15} className="text-gray-400 flex-shrink-0" />
        </Link>
      </div>
    </div>
  )
}
