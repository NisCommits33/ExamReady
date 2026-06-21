import { cn } from '@/lib/utils'

/**
 * LOKAI brand mark — a rounded brand-blue tile with an interlocked L+K monogram.
 * `wordmark` renders the "LOKAI" text beside the tile.
 */
export function Logo({ size = 32, wordmark = false, className }: { size?: number; wordmark?: boolean; className?: string }) {
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <svg width={size} height={size} viewBox="0 0 100 100" fill="none" role="img" aria-label="LOKAI" className="flex-shrink-0">
        <defs>
          <linearGradient id="lokai-tile" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#2A77C9" />
            <stop offset="1" stopColor="#0C447C" />
          </linearGradient>
        </defs>
        <rect width="100" height="100" rx="24" fill="url(#lokai-tile)" />
        <g stroke="#ffffff" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round">
          <path d="M35 29 V71" />
          <path d="M35 71 H53" />
          <path d="M69 29 L43 50" />
          <path d="M43 50 L69 71" />
        </g>
      </svg>
      {wordmark && <span className="text-base font-semibold tracking-tight text-gray-900 dark:text-gray-100">LOKAI</span>}
    </div>
  )
}
