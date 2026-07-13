'use client'

import { useState, useRef, useEffect } from 'react'
import { X, Trash2, MessageSquare, Maximize2, Minimize2 } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { useChatState, useChatActions } from './ChatProvider'
import { ChatConversation } from './ChatConversation'

/**
 * Overlay chat: a bottom sheet on mobile (drag-to-dismiss) and a right-side drawer on
 * tablet/desktop below the inline-pane breakpoint. The thread itself lives in
 * <ChatConversation>, shared with the desktop inline pane.
 */
export function ChatPanel() {
  const { open, expanded, topicName, messages, streaming } = useChatState()
  const { closeChat, clear, setExpanded } = useChatActions()
  const [kbInset, setKbInset] = useState(0) // px the on-screen keyboard covers (mobile)
  const [dragY, setDragY] = useState(0)      // px the sheet is dragged down (mobile swipe-to-dismiss)
  const dragStartRef = useRef<number | null>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  // Keep the mobile bottom sheet above the on-screen keyboard via the VisualViewport API.
  useEffect(() => {
    if (!open) return
    const vv = window.visualViewport
    if (!vv) return
    const onResize = () => {
      const inset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop)
      setKbInset(window.innerWidth < 768 ? inset : 0)
    }
    onResize()
    vv.addEventListener('resize', onResize)
    vv.addEventListener('scroll', onResize)
    return () => { vv.removeEventListener('resize', onResize); vv.removeEventListener('scroll', onResize); setKbInset(0) }
  }, [open])

  // Escape to close; trap Tab within the panel while it's open.
  useEffect(() => {
    if (!open) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); closeChat(); return }
      if (e.key !== 'Tab' || !panelRef.current) return
      const focusable = panelRef.current.querySelectorAll<HTMLElement>(
        'button, textarea, [href], input, select, [tabindex]:not([tabindex="-1"])',
      )
      const list = Array.from(focusable).filter(el => !el.hasAttribute('disabled'))
      if (list.length === 0) return
      const first = list[0]
      const last = list[list.length - 1]
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, closeChat])

  function handleClear() {
    clear()
    toast('Chat cleared')
  }

  // ── Mobile swipe-to-dismiss (drag the handle/header down) ──
  function onDragStart(e: React.TouchEvent) {
    if (window.innerWidth >= 768) return // sheet gesture is mobile-only
    dragStartRef.current = e.touches[0].clientY
  }
  function onDragMove(e: React.TouchEvent) {
    if (dragStartRef.current == null) return
    const dy = e.touches[0].clientY - dragStartRef.current
    setDragY(Math.max(0, dy)) // only downward
  }
  function onDragEnd() {
    if (dragStartRef.current == null) return
    const dismiss = dragY > 110
    setDragY(0) // reset offset either way (spring back, or before closing)
    if (dismiss) closeChat()
    dragStartRef.current = null
  }

  if (!open) return null

  const isEmpty = messages.length === 0

  return (
    <>
      {/* Scrim (mobile bottom sheet) — strong enough to isolate foreground */}
      <div
        className="fixed inset-0 z-40 bg-black/40 dark:bg-black/60 md:hidden animate-in fade-in duration-200 motion-reduce:animate-none"
        onClick={closeChat}
      />

      {/* Panel */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={topicName ? `Ask AI about ${topicName}` : 'Ask AI chat'}
        style={{
          ...(kbInset > 0 ? { bottom: kbInset, height: `calc(88dvh - ${kbInset}px)` } : {}),
          ...(dragY > 0 ? { transform: `translateY(${dragY}px)`, transition: 'none' } : {}),
        }}
        className={cn(
          'fixed z-50 flex flex-col bg-white dark:bg-[#161B22] shadow-2xl transform-gpu will-change-transform',
          'bottom-0 left-0 right-0 rounded-t-2xl transition-[height,width,border-radius,transform] duration-[250ms] ease-out',
          expanded ? 'h-dvh rounded-none' : 'h-[88dvh]',
          expanded
            ? 'md:top-4 md:bottom-4 md:right-4 md:left-auto md:h-auto md:w-[min(680px,calc(100vw-2rem))] md:rounded-2xl'
            : 'md:top-0 md:bottom-0 md:right-0 md:left-auto md:h-full md:w-[400px] md:rounded-none md:rounded-l-2xl',
          'animate-in slide-in-from-bottom md:slide-in-from-right duration-[250ms] ease-out motion-reduce:animate-none motion-reduce:transition-none',
        )}
      >
        {/* Mobile drag handle */}
        <div
          className="md:hidden flex-shrink-0 flex justify-center pt-2.5 pb-1 cursor-grab active:cursor-grabbing touch-none"
          onTouchStart={onDragStart}
          onTouchMove={onDragMove}
          onTouchEnd={onDragEnd}
        >
          <div className="w-9 h-1 rounded-full bg-gray-300 dark:bg-[#30363D]" />
        </div>

        {/* Header */}
        <div
          className="flex items-center gap-3 px-4 py-2.5 md:py-3 border-b border-gray-200 dark:border-[#30363D] flex-shrink-0"
          onTouchStart={onDragStart}
          onTouchMove={onDragMove}
          onTouchEnd={onDragEnd}
        >
          <div className="w-7 h-7 rounded-lg bg-brand-600 flex items-center justify-center flex-shrink-0">
            <MessageSquare size={14} className="text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Ask AI</p>
            {topicName && <p className="text-xs text-gray-400 truncate">{topicName}</p>}
          </div>
          <button
            onClick={() => setExpanded(!expanded)}
            aria-label={expanded ? 'Collapse chat' : 'Expand chat'}
            title={expanded ? 'Collapse chat' : 'Expand chat'}
            className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-[#1C2128] text-gray-400 transition-colors"
          >
            {expanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>
          <button
            onClick={handleClear}
            disabled={isEmpty || streaming}
            aria-label="Clear conversation"
            title="Clear conversation"
            className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-[#1C2128] text-gray-400 transition-colors disabled:opacity-30"
          >
            <Trash2 size={16} />
          </button>
          <button
            onClick={closeChat}
            aria-label="Close chat"
            className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-[#1C2128] text-gray-400 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <ChatConversation variant="drawer" />
      </div>
    </>
  )
}
