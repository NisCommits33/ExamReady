'use client'

import { useEffect, useRef, useState } from 'react'

export interface SavedPosition { tab: string | null; scroll: number | null }

interface Options {
  /** Whether the current view is a scrollable reading tab. */
  enabled: boolean
  /** Current reading tab (persisted alongside the scroll fraction). */
  tab: string
  /** Saved position loaded from storage, or null if none. */
  saved: SavedPosition | null
  /** Persist the current tab + scroll fraction (0–1). Debounced by the hook. */
  save: (tab: string, scroll: number) => void
  /** Switch to the saved tab (component-specific). Scroll restore is handled by the hook. */
  onResumeTab: (tab: string) => void
}

/** Current scroll position as a fraction (0–1) of the document's scrollable height. */
function scrollFraction(): number {
  const max = document.documentElement.scrollHeight - window.innerHeight
  return max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0
}

/**
 * "Continue where you left off": persists the reading tab + scroll position as the user
 * scrolls, and offers a banner to jump back on return.
 */
export function useResumeReading({ enabled, tab, saved, save, onResumeTab }: Options) {
  const canResume = !!saved && !!saved.tab && (saved.scroll ?? 0) > 0.05
  const [dismissed, setDismissed] = useState(false)
  const showResume = canResume && !dismissed
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Keep the latest `save`/`tab` in a ref so the scroll listener isn't torn down
  // (and its debounce timer cleared) on every parent re-render.
  const latest = useRef({ save, tab })
  useEffect(() => { latest.current = { save, tab } })

  // Persist tab + scroll as the user reads.
  useEffect(() => {
    if (!enabled) return
    const onScroll = () => {
      if (saveTimer.current) clearTimeout(saveTimer.current)
      saveTimer.current = setTimeout(() => {
        latest.current.save(latest.current.tab, scrollFraction())
      }, 700)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      if (saveTimer.current) clearTimeout(saveTimer.current)
    }
  }, [enabled])

  function continueReading() {
    setDismissed(true)
    if (saved?.tab) onResumeTab(saved.tab)
    setTimeout(() => {
      const max = document.documentElement.scrollHeight - window.innerHeight
      window.scrollTo({ top: (saved?.scroll ?? 0) * max, behavior: 'smooth' })
    }, 90)
  }

  return { showResume, dismissResume: () => setDismissed(true), continueReading }
}
