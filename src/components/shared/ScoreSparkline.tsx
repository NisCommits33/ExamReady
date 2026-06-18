'use client'

export function ScoreSparkline({ scores }: { scores: number[] }) {
  if (scores.length < 2) return null
  const w = 48, h = 20
  const points = scores.map((s, i) => `${(i / (scores.length - 1)) * w},${h - (s / 100) * h}`).join(' ')
  const last = scores[scores.length - 1]
  const color = last >= 60 ? '#22c55e' : last >= 40 ? '#eab308' : '#ef4444'
  return (
    <svg width={w} height={h} className="flex-shrink-0">
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
