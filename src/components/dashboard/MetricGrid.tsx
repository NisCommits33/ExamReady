import { ProgressBar } from '@/components/shared/ProgressBar'

interface MetricGridProps {
  sessionCount: number
  totalHours: number
  p1Coverage: number
  p2Coverage: number
}

export function MetricGrid({ sessionCount, totalHours, p1Coverage, p2Coverage }: MetricGridProps) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <MetricCard label="Sessions done" value={sessionCount.toString()} />
      <MetricCard label="Hours studied" value={`${totalHours}h`} />
      <MetricCard label="P1 coverage" value={`${p1Coverage}%`}>
        <ProgressBar value={p1Coverage} color="bg-brand-400" className="mt-2" />
      </MetricCard>
      <MetricCard label="P2 coverage" value={`${p2Coverage}%`}>
        <ProgressBar value={p2Coverage} color="bg-teal-400" className="mt-2" />
      </MetricCard>
    </div>
  )
}

function MetricCard({ label, value, children }: { label: string; value: string; children?: React.ReactNode }) {
  return (
    <div className="bg-white dark:bg-[#161B22] border border-gray-200 dark:border-[#30363D] rounded-xl p-4">
      <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">{label}</p>
      <p className="text-2xl font-medium text-gray-900 dark:text-gray-100 mt-1 tabular-nums">{value}</p>
      {children}
    </div>
  )
}
