import { daysToExam, formatDate } from '@/lib/utils'
import { EXAM_DATE } from '@/lib/constants'

interface CountdownCardProps {
  readiness: number
  sessionCount: number
  totalHours: number
}

export function CountdownCard({ readiness, sessionCount, totalHours }: CountdownCardProps) {
  const days = daysToExam()
  const radius = 15.9
  const circumference = 2 * Math.PI * radius
  const strokeDash = (readiness / 100) * circumference

  return (
    <div className="bg-brand-50 border border-brand-100 dark:border-brand-900/40 rounded-xl p-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-baseline gap-1.5">
            <span className="text-[64px] font-medium text-brand-800 leading-none tracking-tight" style={{ letterSpacing: '-0.03em' }}>
              {days}
            </span>
            <span className="text-xl text-brand-600 font-medium">days</span>
          </div>
          <p className="text-xs text-brand-600 mt-1">to exam · {formatDate(EXAM_DATE.toISOString())}</p>
          <div className="flex items-center gap-3 mt-3">
            <span className="text-xs text-brand-700">
              <strong className="font-semibold">{sessionCount}</strong> sessions
            </span>
            <span className="text-brand-400">·</span>
            <span className="text-xs text-brand-700">
              <strong className="font-semibold">{totalHours}h</strong> studied
            </span>
          </div>
        </div>

        <div className="flex-shrink-0 flex flex-col items-center gap-1">
          <svg width="80" height="80" viewBox="0 0 40 40" className="-rotate-90">
            <circle cx="20" cy="20" r={radius} fill="none" stroke="currentColor" strokeWidth="4" className="text-brand-200 dark:text-brand-900/60" />
            <circle
              cx="20" cy="20" r={radius}
              fill="none" stroke="#185FA5" strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray={`${strokeDash} ${circumference}`}
              className="transition-all duration-700"
            />
          </svg>
          <div className="text-center -mt-[68px] mb-[16px] pointer-events-none">
            <p className="text-lg font-semibold text-brand-800">{readiness}%</p>
            <p className="text-[9px] text-brand-600 font-medium uppercase tracking-wide">READY</p>
          </div>
        </div>
      </div>
    </div>
  )
}
