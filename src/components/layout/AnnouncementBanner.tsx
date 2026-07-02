'use client'

import { useEffect, useState } from 'react'
import { X, Megaphone } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface BannerAnnouncement { id: string; message: string; level: 'info' | 'warning' | 'critical' }

const TINT: Record<string, string> = {
  info: 'bg-brand-50 dark:bg-brand-900/20 text-brand-800 dark:text-brand-300 border-brand-200 dark:border-brand-900/40',
  warning: 'bg-amber-50 dark:bg-amber-900/15 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-900/40',
  critical: 'bg-red-50 dark:bg-red-900/15 text-red-800 dark:text-red-300 border-red-200 dark:border-red-900/40',
}

export function AnnouncementBanner({ announcements }: { announcements: BannerAnnouncement[] }) {
  const [dismissed, setDismissed] = useState<string[]>([])

  useEffect(() => {
    // Hydrate dismissed list from localStorage on mount (client-only).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    try { setDismissed(JSON.parse(localStorage.getItem('dismissed_announcements') ?? '[]')) } catch {}
  }, [])

  function dismiss(id: string) {
    const next = [...dismissed, id]
    setDismissed(next)
    try { localStorage.setItem('dismissed_announcements', JSON.stringify(next)) } catch {}
  }

  const visible = announcements.filter(a => !dismissed.includes(a.id))
  if (visible.length === 0) return null

  return (
    <div className="space-y-2 mb-4">
      {visible.map(a => (
        <div key={a.id} className={cn('flex items-start gap-2 px-3 py-2 border rounded-lg', TINT[a.level] ?? TINT.info)}>
          <Megaphone size={14} className="flex-shrink-0 mt-0.5" />
          <p className="text-xs flex-1">{a.message}</p>
          <button onClick={() => dismiss(a.id)} className="flex-shrink-0 opacity-60 hover:opacity-100" aria-label="Dismiss"><X size={13} /></button>
        </div>
      ))}
    </div>
  )
}
