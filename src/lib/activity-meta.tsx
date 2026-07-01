import {
  FileText, Sparkles, Brain, MessageSquare, CalendarClock, LifeBuoy, PenLine,
  Globe, Flame, BookOpen, Upload, Wand2,
} from 'lucide-react'

export interface ActionMeta { label: string; Icon: typeof FileText; color: string }

export const ACTION_META: Record<string, ActionMeta> = {
  generate_note:          { label: 'Generated a study note',       Icon: FileText,      color: 'text-brand-500' },
  extract_note_sections:  { label: 'Extracted key points',         Icon: Sparkles,      color: 'text-brand-500' },
  generate_mcq:           { label: 'Generated MCQ drill',          Icon: Brain,         color: 'text-purple-500' },
  generate_iq:            { label: 'Generated IQ questions',       Icon: Brain,         color: 'text-purple-500' },
  generate_gk:            { label: 'Generated GK questions',       Icon: Globe,         color: 'text-brand-500' },
  generate_arff:          { label: 'Generated ARFF questions',     Icon: Flame,         color: 'text-teal-500' },
  generate_p2_question:   { label: 'Generated a Paper 2 question', Icon: PenLine,       color: 'text-teal-500' },
  grade_answer:           { label: 'Graded an answer',             Icon: PenLine,       color: 'text-teal-500' },
  extract_p2_question:    { label: 'Extracted a past question',    Icon: FileText,      color: 'text-teal-500' },
  ai_chat:                { label: 'Asked the AI tutor',           Icon: MessageSquare, color: 'text-brand-500' },
  rescue_agent:           { label: 'Ran a rescue plan',            Icon: LifeBuoy,      color: 'text-danger-500' },
  replan_schedule:        { label: 'Replanned the schedule',       Icon: CalendarClock, color: 'text-teal-500' },
  weekly_report:          { label: 'Generated weekly review',      Icon: Sparkles,      color: 'text-purple-500' },
  simplify:               { label: 'Simplified content',           Icon: Wand2,         color: 'text-purple-500' },
  elaborate:              { label: 'Elaborated a topic',           Icon: Globe,         color: 'text-brand-500' },
  extract_source:         { label: 'Uploaded a source',            Icon: Upload,        color: 'text-brand-500' },
  scaffold_exam:          { label: 'Scaffolded an exam',           Icon: BookOpen,      color: 'text-brand-500' },
  suggest_subtopics:      { label: 'Suggested subtopics',          Icon: Sparkles,      color: 'text-brand-500' },
  refresh_current_affairs:{ label: 'Refreshed current affairs',    Icon: Globe,         color: 'text-teal-500' },
}

export function actionMeta(action: string): ActionMeta {
  return ACTION_META[action] ?? { label: action.replace(/_/g, ' '), Icon: Sparkles, color: 'text-gray-400' }
}
