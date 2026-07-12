import { StatGridSkeleton, TableSkeleton } from '@/components/ui/skeletons'

export default function Loading() {
  return (
    <div className="space-y-5">
      <StatGridSkeleton cols={6} count={6} />
      <TableSkeleton rows={6} />
    </div>
  )
}
