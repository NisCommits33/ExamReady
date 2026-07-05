'use client'

import { Trash2 } from 'lucide-react'
import { HIGHLIGHT_COLORS } from '@/lib/highlight'

export interface PopoverState {
  x: number
  y: number
  kind: 'create' | 'edit'
  hlId?: string
  /** For 'create': the selected text + occurrence index, captured at selection time. */
  text?: string
  nth?: number
}

interface Props {
  popover: PopoverState
  onPick: (colorKey: string) => void
  onRemove: (id: string) => void
}

/** Floating colour picker anchored to a text selection ('create') or an existing highlight ('edit'). */
export function HighlightPopover({ popover, onPick, onRemove }: Props) {
  return (
    <div
      data-hl-popover
      // Prevent mousedown from collapsing the active text selection before onClick fires.
      onMouseDown={(e) => e.preventDefault()}
      style={{ left: popover.x, top: popover.y }}
      className="fixed z-50 -translate-x-1/2 -translate-y-[calc(100%+8px)] bg-white dark:bg-[#161B22] border border-gray-200 dark:border-[#30363D] rounded-lg shadow-lg px-2 py-1.5 flex items-center gap-1.5"
    >
      {HIGHLIGHT_COLORS.map(c => (
        <button
          key={c.key}
          onClick={() => onPick(c.key)}
          title={popover.kind === 'edit' ? `Change to ${c.label.toLowerCase()}` : `Highlight ${c.label.toLowerCase()}`}
          aria-label={popover.kind === 'edit' ? `Change to ${c.label.toLowerCase()}` : `Highlight ${c.label.toLowerCase()}`}
          className="w-5 h-5 rounded-full border border-black/10 dark:border-white/20 hover:scale-110 transition-transform"
          style={{ backgroundColor: c.bg }}
        />
      ))}
      {popover.kind === 'edit' && popover.hlId && (
        <>
          <div className="w-px h-4 bg-gray-200 dark:bg-[#30363D] mx-0.5" />
          <button
            onClick={() => onRemove(popover.hlId!)}
            title="Remove highlight"
            aria-label="Remove highlight"
            className="w-6 h-6 flex items-center justify-center rounded-md text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
          >
            <Trash2 size={14} />
          </button>
        </>
      )}
    </div>
  )
}
