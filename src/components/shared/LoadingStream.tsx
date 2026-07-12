'use client'

import { cn } from '@/lib/utils'
import { Markdown } from '@/components/ui/Markdown'
import { ContentSkeleton } from '@/components/ui/skeletons'

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
    <div aria-busy="true" aria-live="polite">
      <span className="sr-only" role="status">Generating content</span>
      <ContentSkeleton lines={6} />
    </div>
  )
}
