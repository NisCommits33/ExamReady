'use client'

import { useCallback, useEffect, useRef } from 'react'
import { recordStudyEvent } from '@/lib/study-events'

const FLUSH_THRESHOLD_S = 60
const IDLE_AFTER_MS = 60_000
const TICK_MS = 5_000

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return Boolean(target.closest('input, textarea, select, [contenteditable="true"], [role="textbox"]'))
}

interface UseStudyActivityTrackerOptions {
  topicId: string
  subtopicId?: string | null
  tab: string
  enabled?: boolean
}

export function useStudyActivityTracker({ topicId, subtopicId = null, tab, enabled = true }: UseStudyActivityTrackerOptions) {
  const bufferedSeconds = useRef(0)
  const bufferStartedAt = useRef<Date | null>(null)
  const lastActivityAt = useRef(0)
  const latest = useRef({ topicId, subtopicId, tab, enabled })

  useEffect(() => {
    latest.current = { topicId, subtopicId, tab, enabled }
  }, [topicId, subtopicId, tab, enabled])

  const flush = useCallback((force = false) => {
    const seconds = Math.floor(bufferedSeconds.current)
    if (seconds <= 0) return
    if (!force && seconds < FLUSH_THRESHOLD_S) return

    const startedAt = bufferStartedAt.current ?? new Date(Date.now() - seconds * 1000)
    const endedAt = new Date()
    const snapshot = latest.current
    bufferedSeconds.current = 0
    bufferStartedAt.current = null

    void recordStudyEvent({
      topicId: snapshot.topicId,
      subtopicId: snapshot.subtopicId,
      eventType: 'reading',
      source: 'reader',
      startedAt: startedAt.toISOString(),
      endedAt: endedAt.toISOString(),
      durationS: seconds,
      metadata: { tab: snapshot.tab },
    })
  }, [])

  useEffect(() => {
    if (!enabled) {
      flush(true)
      return
    }

    lastActivityAt.current = Date.now()

    const markActive = (event: Event) => {
      if (isEditableTarget(event.target)) return
      lastActivityAt.current = Date.now()
    }
    const onVisibilityChange = () => {
      if (document.hidden) flush(true)
      else lastActivityAt.current = Date.now()
    }
    const onBeforeUnload = () => flush(true)

    window.addEventListener('mousemove', markActive, { passive: true })
    window.addEventListener('keydown', markActive)
    window.addEventListener('scroll', markActive, { passive: true })
    window.addEventListener('touchstart', markActive, { passive: true })
    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('beforeunload', onBeforeUnload)

    const interval = window.setInterval(() => {
      if (!latest.current.enabled || document.hidden) return
      const activeElement = document.activeElement
      if (isEditableTarget(activeElement)) return
      if (Date.now() - lastActivityAt.current > IDLE_AFTER_MS) return

      if (!bufferStartedAt.current) bufferStartedAt.current = new Date()
      bufferedSeconds.current += TICK_MS / 1000
      flush(false)
    }, TICK_MS)

    return () => {
      window.clearInterval(interval)
      window.removeEventListener('mousemove', markActive)
      window.removeEventListener('keydown', markActive)
      window.removeEventListener('scroll', markActive)
      window.removeEventListener('touchstart', markActive)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('beforeunload', onBeforeUnload)
      flush(true)
    }
  }, [enabled, flush])

  useEffect(() => {
    return () => flush(true)
  }, [tab, topicId, subtopicId, flush])
}
