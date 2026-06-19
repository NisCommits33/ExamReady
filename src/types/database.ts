export type TopicStatus = 'not_started' | 'in_progress' | 'done'
export type PaperType = 1 | 2
export type SectionType = 'A' | 'B'
export type ShiftType = 'A' | 'B'
export type SessionType = 'study' | 'drill' | 'review' | 'iq'
export type AnnotationType = 'note' | 'highlight' | 'question'
export type QuestionType = '5mark' | '10mark'
export type IQCategory = 'verbal' | 'non_verbal' | 'arithmetic'
export type Confidence = 'sure' | 'unsure' | 'guessing'
export type Difficulty = 'easy' | 'medium' | 'hard'
export type IQType = 'series' | 'analogy' | 'coding_decoding' | 'direction_distance' |
  'logical_reasoning' | 'arithmetic' | 'figure_series' | 'mirror_water' |
  'figure_matrix' | 'venn_diagram'

export interface Topic {
  id: string
  name: string
  paper: PaperType
  section: SectionType
  topic_number: string
  subsections: string[]
  // Per-user progress (lives in user_topic_progress, merged at fetch time)
  status: TopicStatus
  is_flagged: boolean
  last_studied: string | null
  mcq_best_score: number | null
  ai_priority: number
  exam_id?: string | null
  section_id?: string | null
  created_at: string
}

export interface Shift {
  id: string
  date: string
  type: ShiftType
  study_start: string
  study_end: string
  created_at: string
}

export interface Session {
  id: string
  date: string
  topic_id: string | null
  duration_mins: number
  notes: string | null
  created_at: string
}

export interface PlannedSession {
  id: string
  topic_id: string | null
  scheduled_date: string
  shift_type: ShiftType | null
  slot_time: string | null
  duration_mins: number
  session_type: SessionType
  ai_generated: boolean
  completed: boolean
  linked_session_id: string | null
  created_at: string
  topics?: { name: string; paper: PaperType; section: SectionType } | null
}

export interface TopicNote {
  id: string
  topic_id: string
  study_note: string | null
  key_points: string | null
  exam_tips: string | null
  official_source: string | null
  official_source_2: string | null
  model_answer_5mark: string | null
  model_answer_10mark: string | null
  generated_at: string | null
  model_used: string | null
  updated_at: string
}

export interface UserAnnotation {
  id: string
  topic_id: string
  content: string
  annotation_type: AnnotationType
  created_at: string
}

export interface P2Answer {
  id: string
  topic_id: string
  question_type: QuestionType
  question_text: string | null
  user_answer: string
  ai_feedback: string | null
  ai_score: number | null
  attempted_at: string
}

export interface IQQuestion {
  id: string
  type: IQType
  category: IQCategory
  question_text: string
  question_figure?: string | null
  options: { A: string; B: string; C: string; D: string }
  correct_answer: string
  difficulty: Difficulty
  explanation: string
  created_at: string
}

export interface IQAttempt {
  id: string
  question_id: string
  selected_answer: string | null
  is_correct: boolean | null
  time_taken_s: number | null
  confidence: Confidence | null
  attempted_at: string
}

export interface IQStats {
  id: string
  type: IQType
  accuracy_pct: number
  avg_time_s: number
  total_attempted: number
  last_drilled: string | null
}

export interface WeeklyReport {
  id: string
  week_start: string
  content: string
  risk_topics: string[]
  generated_at: string
}

export type SectionKind = 'mcq_study' | 'aptitude' | 'written'

export interface ExamConfig {
  pass_mark?: number
  negative_marking?: number
  mcq_time_limit_s?: number
  iq_time_target_s?: number
  rescue_threshold_days?: number
  default_exam_date?: string
}

export interface Exam {
  id: string
  slug: string | null
  name: string
  body: string | null
  description: string | null
  is_public: boolean
  created_by: string | null
  cloned_from: string | null
  config: ExamConfig
  created_at: string
}

export interface ExamSection {
  id: string
  exam_id: string
  name: string
  kind: SectionKind
  sort_order: number
  config: Record<string, unknown>
}

export interface Enrollment {
  id: string
  user_id: string
  exam_id: string
  exam_date: string | null
  is_active: boolean
  created_at: string
}

export type DrillSection = 'gk' | 'iq' | 'arff'

export interface DrillResult {
  id: string
  section: DrillSection
  topic_id: string | null
  subtopic_id?: string | null
  score: number
  total: number
  created_at: string
  topics?: { name: string } | null
}

export interface Subtopic {
  id: string
  topic_id: string
  name: string
  sort_order: number
  study_note: string | null
  key_points: string | null
  official_source: string | null
  is_dynamic: boolean
  generated_at: string | null
  created_at: string
}

export interface ActivityLog {
  id: string
  action: string
  topic_id: string | null
  meta: Record<string, unknown>
  created_at: string
}

export interface FlashcardReview {
  card_key: string
  topic_id: string | null
  front: string
  back: string
  interval_days: number
  ease: number
  due_date: string
  last_reviewed: string | null
  review_count: number
  created_at: string
}

export interface KeyNumber {
  id: string
  topic_id: string | null
  fact: string
  value: string
  created_at: string
  topics?: { name: string } | null
}

export interface TopicFlag {
  id: string
  topic_id: string
  note: string | null
  flagged_at: string
  resolved: boolean
  resolved_at: string | null
}

export interface AINote {
  id: string
  topic_id: string
  content: string
  generated_at: string
}

export interface AIDrill {
  id: string
  topic_id: string
  questions: MCQuestion[]
  session_id: string | null
  created_at: string
}

export interface MCQuestion {
  question: string
  options: { A: string; B: string; C: string; D: string }
  correct: 'A' | 'B' | 'C' | 'D'
  explanation: string
  trap: string
}
