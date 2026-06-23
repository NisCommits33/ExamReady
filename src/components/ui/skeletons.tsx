import { cn } from '@/lib/utils'

/** Base shimmer block. */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-md bg-gray-200 dark:bg-[#1C2128]', className)} />
}

function Card({ children, className }: { children?: React.ReactNode; className?: string }) {
  return <div className={cn('bg-white dark:bg-[#161B22] border border-gray-200 dark:border-[#30363D] rounded-xl p-4', className)}>{children}</div>
}

function PageHeader() {
  return (
    <div className="mb-5 space-y-2">
      <Skeleton className="h-6 w-40" />
      <Skeleton className="h-3.5 w-56" />
    </div>
  )
}

/** A grid of stat cards. */
export function StatGridSkeleton({ cols = 4, count = 4 }: { cols?: number; count?: number }) {
  return (
    <div className={cn('grid gap-3', cols === 6 ? 'grid-cols-2 lg:grid-cols-6' : 'grid-cols-2 sm:grid-cols-4')}>
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i}>
          <Skeleton className="h-3 w-12 mb-3" />
          <Skeleton className="h-6 w-16" />
        </Card>
      ))}
    </div>
  )
}

/** A list of row cards. */
export function ListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center justify-between px-4 py-3.5 bg-white dark:bg-[#161B22] border border-gray-200 dark:border-[#30363D] rounded-xl">
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-3 w-1/4" />
          </div>
          <Skeleton className="h-5 w-14 rounded-full" />
        </div>
      ))}
    </div>
  )
}

/** Generic page: header + stat grid + list — neutral fallback that fits most screens. */
export function PageSkeleton() {
  return (
    <div>
      <PageHeader />
      <div className="mb-4"><StatGridSkeleton /></div>
      <ListSkeleton />
    </div>
  )
}

/** Topic reader / detail screen. */
export function DetailSkeleton() {
  return (
    <div className="max-w-3xl mx-auto">
      <Skeleton className="h-3 w-24 mb-4" />
      <Skeleton className="h-5 w-2/3 mb-2" />
      <Skeleton className="h-3.5 w-40 mb-5" />
      <div className="flex gap-4 border-b border-gray-200 dark:border-[#30363D] mb-5 pb-2">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-4 w-20" />)}
      </div>
      <div className="space-y-3">
        {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className={cn('h-3.5', i % 3 === 0 ? 'w-full' : i % 3 === 1 ? 'w-11/12' : 'w-3/4')} />)}
      </div>
    </div>
  )
}
