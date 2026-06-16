import Link from 'next/link'
import { Brain, Calendar, Plus } from 'lucide-react'

export function QuickActions({ onLogSession }: { onLogSession: () => void }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      <button
        onClick={onLogSession}
        className="flex flex-col items-center gap-2 py-4 bg-white dark:bg-[#161B22] border border-gray-200 dark:border-[#30363D] rounded-xl hover:border-brand-200 dark:hover:border-brand-800 hover:bg-brand-50 dark:hover:bg-brand-900/20 transition-all duration-150 active:scale-[0.97]"
      >
        <Plus size={20} strokeWidth={1.8} className="text-brand-600" />
        <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Log session</span>
      </button>
      <Link
        href="/iq"
        className="flex flex-col items-center gap-2 py-4 bg-white dark:bg-[#161B22] border border-gray-200 dark:border-[#30363D] rounded-xl hover:border-purple-200 dark:hover:border-purple-800 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-all duration-150 active:scale-[0.97]"
      >
        <Brain size={20} strokeWidth={1.8} className="text-purple-400" />
        <span className="text-xs font-medium text-gray-700 dark:text-gray-300">IQ drill</span>
      </Link>
      <Link
        href="/timetable"
        className="flex flex-col items-center gap-2 py-4 bg-white dark:bg-[#161B22] border border-gray-200 dark:border-[#30363D] rounded-xl hover:border-teal-200 dark:hover:border-teal-800 hover:bg-teal-50 dark:hover:bg-teal-900/20 transition-all duration-150 active:scale-[0.97]"
      >
        <Calendar size={20} strokeWidth={1.8} className="text-teal-400" />
        <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Timetable</span>
      </Link>
    </div>
  )
}
