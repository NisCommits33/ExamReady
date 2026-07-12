import { cn } from '@/lib/utils'
import type { CSSProperties } from 'react'

export function Skeleton({ className, style }: { className?: string; style?: CSSProperties }) {
  return (
    <div
      aria-hidden="true"
      style={style}
      className={cn('skeleton-shimmer rounded-md bg-gray-200 dark:bg-[#1C2128]', className)}
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

export function ChartSkeleton({ bars = 12, className }: { bars?: number; className?: string }) {
  return (
    <Surface className={cn('rounded-xl p-4', className)}>
      <div className="mb-5 flex items-center justify-between"><Skeleton className="h-4 w-36" /><Skeleton className="h-3 w-16" /></div>
      <div className="flex h-40 items-end gap-2 border-b border-gray-100 dark:border-[#21262D]">
        {Array.from({ length: bars }).map((_, i) => (
          <Skeleton key={i} className="min-w-2 flex-1 rounded-b-none" style={{ height: `${35 + ((i * 23) % 55)}%` }} />
        ))}
      </div>
    </Surface>
  )
}

export function AnalyticsSkeleton() {
  return (
    <LoadingRegion label="Loading progress analytics" className="space-y-4">
      <Skeleton className="h-5 w-24" />
      <StatGridSkeleton />
      <div className="grid gap-4 lg:grid-cols-2"><ChartBars /><ChartBars reverse /></div>
      <Surface className="rounded-xl p-4"><Skeleton className="mb-4 h-4 w-32" /><ContentSkeleton lines={6} /></Surface>
    </LoadingRegion>
  )
}

function ChartBars({ reverse = false }: { reverse?: boolean }) {
  const heights = reverse ? [45, 70, 35, 80, 55, 90, 65, 40] : [35, 55, 75, 45, 90, 60, 80, 50]
  return (
    <Surface className="rounded-xl p-4">
      <Skeleton className="mb-5 h-4 w-36" />
      <div className="flex h-40 items-end gap-2 border-b border-gray-100 dark:border-[#21262D]">
        {heights.map((height, i) => <Skeleton key={i} className="flex-1 rounded-b-none" style={{ height: `${height}%` }} />)}
      </div>
    </Surface>
  )
}

export function CalendarSkeleton() {
  return (
    <LoadingRegion label="Loading weekly timetable">
      <div className="mb-4 flex items-center justify-between"><Skeleton className="h-5 w-24" /><Skeleton className="h-8 w-52 rounded-lg" /></div>
      <Surface className="overflow-hidden rounded-xl">
        <div className="grid grid-cols-7 border-b border-gray-200 dark:border-[#30363D]">
          {Array.from({ length: 7 }).map((_, i) => <div key={i} className="border-l border-gray-100 p-3 first:border-0 dark:border-[#21262D]"><Skeleton className="mx-auto h-4 w-10" /></div>)}
        </div>
        <div className="grid min-h-[420px] grid-cols-7">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="space-y-4 border-l border-gray-100 p-2 first:border-0 dark:border-[#21262D]">
              <Skeleton className={cn('h-16 w-full rounded-lg', i % 3 === 1 && 'mt-12', i % 3 === 2 && 'mt-24')} />
              {i % 2 === 0 && <Skeleton className="h-20 w-full rounded-lg" />}
            </div>
          ))}
        </div>
      </Surface>
    </LoadingRegion>
  )
}

export function FormSkeleton() {
  return (
    <LoadingRegion label="Loading profile" className="mx-auto max-w-2xl">
      <Skeleton className="mb-5 h-5 w-20" />
      <Surface className="mb-4 flex min-h-28 items-start gap-4 rounded-xl p-5">
        <Skeleton className="h-16 w-16 flex-none rounded-full" /><div className="flex-1 space-y-3"><Skeleton className="h-5 w-40" /><Skeleton className="h-4 w-56 max-w-full" /><Skeleton className="h-5 w-24 rounded-full" /></div>
      </Surface>
      <StatGridSkeleton />
      <Surface className="mt-4 rounded-xl p-4"><Skeleton className="mb-4 h-4 w-40" /><Skeleton className="h-2 w-full rounded-full" /></Surface>
      <Surface className="mt-4 overflow-hidden rounded-xl"><div className="space-y-3 p-5"><Skeleton className="h-4 w-36" /><Skeleton className="h-3 w-52" /></div><div className="border-t border-gray-100 p-5 dark:border-[#21262D]"><Skeleton className="h-10 w-full rounded-lg" /></div></Surface>
    </LoadingRegion>
  )
}

export function PageSkeleton() {
  return <SectionSkeleton />
}

export const DetailSkeleton = TopicReaderSkeleton
