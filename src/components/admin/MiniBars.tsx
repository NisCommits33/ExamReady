interface Bar { label: string; value: number }

/** Tiny dependency-free vertical bar chart. */
export function MiniBars({ data, height = 80, color = '#185FA5' }: { data: Bar[]; height?: number; color?: string }) {
  const max = Math.max(1, ...data.map(d => d.value))
  return (
    <div className="flex items-end gap-px" style={{ height }}>
      {data.map((d, i) => (
        <div key={i} className="flex-1 flex flex-col justify-end group relative" title={`${d.label}: ${d.value}`}>
          <div
            className="w-full rounded-sm transition-all"
            style={{ height: `${(d.value / max) * 100}%`, backgroundColor: color, minHeight: d.value > 0 ? 2 : 0 }}
          />
        </div>
      ))}
    </div>
  )
}

/** Horizontal labelled bars for categorical breakdowns. */
export function HBars({ data, color = '#185FA5' }: { data: { label: string; value: number }[]; color?: string }) {
  const max = Math.max(1, ...data.map(d => d.value))
  return (
    <div className="space-y-1.5">
      {data.map((d, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="w-40 flex-shrink-0 text-xs text-gray-600 dark:text-gray-400 truncate">{d.label}</span>
          <div className="flex-1 h-3 bg-gray-100 dark:bg-[#1C2128] rounded-full overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${(d.value / max) * 100}%`, backgroundColor: color }} />
          </div>
          <span className="w-8 flex-shrink-0 text-xs tabular-nums text-gray-500 text-right">{d.value}</span>
        </div>
      ))}
    </div>
  )
}
