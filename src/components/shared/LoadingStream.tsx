'use client'

import { cn } from '@/lib/utils'
import { Markdown } from '@/components/ui/Markdown'

interface LoadingStreamProps {
  text: string
  className?: string
  streaming?: boolean
}

export function LoadingStream({ text, className, streaming }: LoadingStreamProps) {
  return (
    <div className={cn('relative', className)}>
      <Markdown>{text}</Markdown>
      {streaming && (
        <span className="inline-block w-0.5 h-4 bg-brand-400 ml-0.5 animate-pulse align-middle" />
      )}
    </div>
  )
}

export function StreamingSkeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      {[100, 90, 75, 95, 60, 80].map((w, i) => (
        <div key={i} className="h-3 bg-gray-200 rounded-full" style={{ width: `${w}%` }} />
      ))}
    </div>
  )
}
