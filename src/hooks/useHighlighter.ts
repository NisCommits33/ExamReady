'use client'

import { useEffect, useState, type RefObject } from 'react'
import { createClient } from '@/lib/supabase/client'
import { applyHighlights, clearHighlights, describeSelection, HL_MARK_SELECTOR, type StoredHighlight } from '@/lib/highlight'
import type { UserAnnotation } from '@/types/database'
import type { PopoverState } from '@/components/shared/HighlightPopover'

interface Options {
  readerRef: RefObject<HTMLDivElement | null>
  /** Current reading tab; highlights are scoped to this. */
  tab: string
  /** Whether the current view is highlightable (reading tab visible). */
  enabled: boolean
  topicId: string
  /** Subtopic scope, or null for topic-level content. */
  subtopicId?: string | null
  annotations: UserAnnotation[]
  setAnnotations: React.Dispatch<React.SetStateAction<UserAnnotation[]>>
  /** Bump this whenever the rendered content changes (e.g. note text) to re-apply highlights. */
  reapplyKey?: unknown
}

/**
 * Text-selection highlighting over rendered Markdown. Re-applies stored highlights on mount /
 * tab change, shows a colour popover on selection, and persists to `user_annotations`.
 */
export function useHighlighter(opts: Options) {
  const { readerRef, tab, enabled, topicId, subtopicId = null, annotations, setAnnotations, reapplyKey } = opts
  const [popover, setPopover] = useState<PopoverState | null>(null)

  // Re-apply stored highlights whenever the tab, scope, or content changes.
  useEffect(() => {
    const root = readerRef.current
    if (!root) return
    if (!enabled) { clearHighlights(root); return }
    const dark = document.documentElement.classList.contains('dark')
    const hls: StoredHighlight[] = annotations
      .filter(a =>
        a.annotation_type === 'highlight' &&
        (a.meta?.tab ?? 'note') === tab &&
        (a.meta?.subtopicId ?? null) === subtopicId)
      .map(a => ({ id: a.id, text: a.content, nth: a.meta?.nth ?? 0, color: a.color }))
    applyHighlights(root, hls, dark)
  }, [readerRef, tab, enabled, subtopicId, annotations, reapplyKey])

  // Dismiss the popover on scroll or an outside click.
  useEffect(() => {
    if (!popover) return
    const close = () => setPopover(null)
    const onDown = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest?.('[data-hl-popover]')) setPopover(null)
    }
    window.addEventListener('scroll', close, { passive: true })
    document.addEventListener('mousedown', onDown)
    return () => {
      window.removeEventListener('scroll', close)
      document.removeEventListener('mousedown', onDown)
    }
  }, [popover])

  function onMouseUp(e: React.MouseEvent) {
    if (!enabled) return
    const mark = (e.target as HTMLElement).closest?.(HL_MARK_SELECTOR) as HTMLElement | null
    if (mark) {
      const r = mark.getBoundingClientRect()
      setPopover({ x: r.left + r.width / 2, y: r.top, kind: 'edit', hlId: mark.getAttribute('data-hl-id') ?? undefined })
      return
    }
    const root = readerRef.current
    const sel = window.getSelection()
    if (!root || !sel || sel.isCollapsed || sel.rangeCount === 0 || !root.contains(sel.anchorNode)) {
      setPopover(null)
      return
    }
    // Capture the selection now — clicking a swatch later would collapse it.
    const desc = describeSelection(root)
    if (!desc) { setPopover(null); return }
    const r = sel.getRangeAt(0).getBoundingClientRect()
    setPopover({ x: r.left + r.width / 2, y: r.top, kind: 'create', text: desc.text, nth: desc.nth })
  }

  async function addHighlight(colorKey: string, text: string, nth: number) {
    const supabase = createClient()
    const { data } = await supabase.from('user_annotations').insert({
      topic_id: topicId,
      content: text,
      annotation_type: 'highlight',
      color: colorKey,
      meta: { tab, nth, subtopicId },
    }).select().single()
    if (data) setAnnotations(prev => [data as UserAnnotation, ...prev])
    window.getSelection()?.removeAllRanges()
    setPopover(null)
  }

  async function removeHighlight(id: string) {
    const supabase = createClient()
    await supabase.from('user_annotations').delete().eq('id', id)
    setAnnotations(prev => prev.filter(a => a.id !== id))
    setPopover(null)
  }

  async function pick(colorKey: string) {
    if (!popover) return
    if (popover.kind === 'edit' && popover.hlId) {
      const id = popover.hlId
      setAnnotations(prev => prev.map(a => (a.id === id ? { ...a, color: colorKey } : a)))
      setPopover(null)
      const supabase = createClient()
      await supabase.from('user_annotations').update({ color: colorKey }).eq('id', id)
    } else if (popover.text) {
      await addHighlight(colorKey, popover.text, popover.nth ?? 0)
    } else {
      setPopover(null)
    }
  }

  return { popover, setPopover, onMouseUp, pick, removeHighlight }
}
