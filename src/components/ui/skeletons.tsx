import { cn } from '@/lib/utils'

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn('animate-pulse rounded-md bg-gray-200 dark:bg-[#1C2128] motion-reduce:animate-none', className)}
    />
  )
}

function LoadingRegion({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <section aria-busy="true" aria-live="polite" className={className}>
      <span className="sr-only" role="status">{label}</span>
      <div aria-hidden="true">{children}</div>
    </section>
  )
}

function Surface({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('border border-gray-200 bg-white dark:border-[#30363D] dark:bg-[#161B22]', className)}>{children}</div>
}

export function StatGridSkeleton({ cols = 4, count = 4 }: { cols?: number; count?: number }) {
  return (
    <div className={cn('grid gap-3', cols === 6 ? 'grid-cols-2 lg:grid-cols-6' : 'grid-cols-2 sm:grid-cols-4')}>
      {Array.from({ length: count }).map((_, i) => (
        <Surface key={i} className="min-h-20 rounded-xl p-4">
          <Skeleton className="mb-3 h-3 w-14" />
          <Skeleton className="h-6 w-16" />
        </Surface>
      ))}
    </div>
  )
}

export function ListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <Surface key={i} className="flex min-h-[66px] items-center justify-between rounded-xl px-4 py-3.5">
          <div className="flex-1 space-y-2">
            <Skeleton className={cn('h-4', i % 3 === 0 ? 'w-1/2' : 'w-2/5')} />
            <Skeleton className="h-3 w-24" />
          </div>
          <Skeleton className="ml-3 h-5 w-16 rounded-full" />
        </Surface>
      ))}
    </div>
  )
}

export function ContentSkeleton({ lines = 7, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn('space-y-3', className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className={cn('h-3.5', i % 4 === 0 ? 'w-full' : i % 4 === 1 ? 'w-11/12' : i % 4 === 2 ? 'w-4/5' : 'w-2/3')} />
      ))}
    </div>
  )
}

export function DashboardSkeleton() {
  return (
    <LoadingRegion label="Loading dashboard" className="space-y-4">
      <div className="flex min-h-12 items-start justify-between">
        <div className="space-y-2"><Skeleton className="h-5 w-44" /><Skeleton className="h-3.5 w-60 max-w-[70vw]" /></div>
        <Skeleton className="h-8 w-20 rounded-full" />
      </div>
      <Surface className="min-h-32 rounded-xl p-5"><Skeleton className="mb-5 h-4 w-36" /><Skeleton className="h-12 w-28" /></Surface>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Surface className="min-h-56 rounded-xl p-4"><Skeleton className="mb-5 h-4 w-28" /><ContentSkeleton lines={5} /></Surface>
        <div><StatGridSkeleton /></div>
      </div>
      <Surface className="min-h-32 rounded-xl p-4"><Skeleton className="mb-4 h-4 w-32" /><ContentSkeleton lines={4} /></Surface>
    </LoadingRegion>
  )
}

export function SectionSkeleton() {
  return (
    <LoadingRegion label="Loading study section">
      <div className="mb-5 flex min-h-12 items-start justify-between gap-3">
        <div className="space-y-2"><Skeleton className="h-5 w-48" /><Skeleton className="h-3.5 w-28" /></div>
        <Skeleton className="h-8 w-24 rounded-lg" />
      </div>
      <Skeleton className="mb-5 h-10 w-full rounded-lg" />
      <StatGridSkeleton />
      <div className="my-4 flex gap-2"><Skeleton className="h-10 flex-1 rounded-lg" /><Skeleton className="h-10 w-28 rounded-lg" /></div>
      <ListSkeleton rows={7} />
    </LoadingRegion>
  )
}

export function TopicReaderSkeleton() {
  return (
    <LoadingRegion label="Loading topic" className="mx-auto max-w-3xl">
      <Skeleton className="mb-4 h-4 w-24" />
      <Skeleton className="mb-2 h-6 w-2/3" />
      <Skeleton className="mb-5 h-3.5 w-40" />
      <div className="mb-5 flex h-10 gap-5 overflow-hidden border-b border-gray-200 dark:border-[#30363D]">
        {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-4 w-20 flex-none" />)}
      </div>
      <div className="mb-5 flex items-center justify-between"><Skeleton className="h-8 w-44 rounded-lg" /><Skeleton className="h-8 w-24 rounded-lg" /></div>
      <Skeleton className="mb-4 h-5 w-1/3" />
      <ContentSkeleton lines={9} />
    </LoadingRegion>
  )
}

export function TableSkeleton({ rows = 7 }: { rows?: number }) {
  return (
    <LoadingRegion label="Loading table">
      <Surface className="overflow-hidden rounded-xl">
        <div className="flex min-h-14 items-center justify-between border-b border-gray-100 px-4 dark:border-[#21262D]">
          <Skeleton className="h-9 w-64 max-w-[70%] rounded-lg" /><Skeleton className="h-3 w-14" />
        </div>
        <div className="hidden h-9 grid-cols-6 gap-3 border-b border-gray-100 px-4 py-3 dark:border-[#21262D] md:grid">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-3 w-16" />)}
        </div>
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="grid min-h-[60px] grid-cols-[1fr_auto] items-center gap-3 border-b border-gray-100 px-4 py-3 last:border-0 dark:border-[#21262D] md:grid-cols-6">
            <div className="space-y-2"><Skeleton className="h-4 w-32" /><Skeleton className="h-3 w-44 max-w-[50vw]" /></div>
            {Array.from({ length: 5 }).map((__, j) => <Skeleton key={j} className={cn('h-3 w-12', j < 4 && 'hidden md:block')} />)}
          </div>
        ))}
      </Surface>
    </LoadingRegion>
  )
}

export function PageSkeleton() {
  return <SectionSkeleton />
}

export const DetailSkeleton = TopicReaderSkeleton
