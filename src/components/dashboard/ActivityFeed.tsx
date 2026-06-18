import { FileText, Sparkles, Brain, MessageSquare, CalendarClock, LifeBuoy, PenLine, Layers, Globe, Flame } from 'lucide-react'
import { relativeDate } from '@/lib/utils'
import type { ActivityLog } from '@/types/database'

const ACTION_META: Record<string, { label: string; Icon: typeof FileText; color: string }> = {
  generate_note:          { label: 'Generated a study note',     Icon: FileText,      color: 'text-brand-500' },
  extract_note_sections:  { label: 'Extracted key points',       Icon: Sparkles,      color: 'text-brand-500' },
  generate_mcq:           { label: 'Generated MCQ drill',        Icon: Brain,         color: 'text-purple-500' },
  generate_iq:            { label: 'Generated IQ questions',     Icon: Brain,         color: 'text-purple-500' },
  generate_gk:            { label: 'Generated GK questions',     Icon: Globe,         color: 'text-brand-500' },
  generate_arff:          { label: 'Generated ARFF questions',   Icon: Flame,         color: 'text-teal-500' },
  generate_p2_question:   { label: 'Generated a Paper 2 question', Icon: PenLine,     color: 'text-teal-500' },
  grade_answer:           { label: 'Graded an answer',           Icon: PenLine,       color: 'text-teal-500' },
  extract_p2_question:    { label: 'Extracted a past question',  Icon: FileText,      color: 'text-teal-500' },
  ai_chat:                { label: 'Asked the AI tutor',         Icon: MessageSquare, color: 'text-brand-500' },
  rescue_agent:           { label: 'Ran a rescue plan',          Icon: LifeBuoy,      color: 'text-danger-500' },
  replan_schedule:        { label: 'Replanned the schedule',     Icon: CalendarClock, color: 'text-teal-500' },
  weekly_report:          { label: 'Generated weekly review',    Icon: Sparkles,      color: 'text-purple-500' },
}

export function ActivityFeed({ activities }: { activities: ActivityLog[] }) {
  if (activities.length === 0) return null

  return (
    <div className="bg-white dark:bg-[#161B22] border border-gray-200 dark:border-[#30363D] rounded-xl p-4">
      <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">Recent activity</p>
      <div className="space-y-2.5">
        {activities.slice(0, 6).map(a => {
          const meta = ACTION_META[a.action] ?? { label: a.action.replace(/_/g, ' '), Icon: Sparkles, color: 'text-gray-400' }
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
