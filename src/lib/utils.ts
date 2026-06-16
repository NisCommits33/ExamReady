import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { EXAM_DATE } from './constants'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function daysToExam(): number {
  const now = new Date()
  const diff = EXAM_DATE.getTime() - now.getTime()
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
}

export function formatDuration(mins: number): string {
  if (mins < 60) return `${mins}m`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m === 0 ? `${h}h` : `${h}h ${m}m`
}

export function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

export function relativeDate(date: string | Date | null): string {
  if (!date) return 'Never'
  const d = typeof date === 'string' ? new Date(date) : date
  const now = new Date()
  const diff = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24))
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Yesterday'
  if (diff < 7) return `${diff} days ago`
  return formatDate(d)
}

export function coveragePct(
  status: 'not_started' | 'in_progress' | 'done',
  mcqScore: number | null
): number {
  if (status === 'done') return 100
  if (status === 'not_started') return 0
  return mcqScore ? Math.min(Math.round(mcqScore * 10), 90) : 25
}

export function gradeColor(pct: number): string {
  if (pct >= 70) return 'bg-success-400'
  if (pct >= 50) return 'bg-warning-400'
  return 'bg-danger-400'
}
