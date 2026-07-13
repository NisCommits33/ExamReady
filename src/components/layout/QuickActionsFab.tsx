'use client'

import { useState, useEffect } from 'react'
import { Timer, MessageSquare, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useChatActions } from '@/components/ai/ChatProvider'
import { usePomodoro, PomodoroPanel } from '@/components/shared/PomodoroProvider'

function haptic() {
  try { navigator.vibrate?.(10) } catch { /* unsupported */ }
}

/**
 * One bottom-right control merging "Ask AI" + the Pomodoro timer into an iOS-style
 * speed-dial. When the timer is running the button shows a live countdown. When the
 * desktop chat rail is docked, the button sits left of the rail and drops the (now
 * redundant) Ask AI action.
 */
export function QuickActionsFab({ docked = false, dockExpanded = false }: { docked?: boolean; dockExpanded?: boolean }) {
  const { openChat } = useChatActions()
  const { running, timeText, fabTint } = usePomodoro()
  const [expanded, setExpanded] = useState(false)
  const [timerOpen, setTimerOpen] = useState(false)

  useEffect(() => {
    if (!expanded && !timerOpen) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { setExpanded(false); setTimerOpen(false) } }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [expanded, timerOpen])

  function toggle() { haptic(); setExpanded(e => !e); setTimerOpen(false) }
  function askAi() { haptic(); setExpanded(false); openChat() }
  function openTimer() { haptic(); setExpanded(false); setTimerOpen(true) }

  // Bottom-right anchor; shift left of the chat rail when it's docked (xl only).
  const anchorX = cn(
    'right-4 md:right-6',
    docked && (dockExpanded ? 'xl:right-[calc(520px+1.5rem)]' : 'xl:right-[calc(360px+1.5rem)]'),
  )

  return (
    <>
      {/* Scrim to catch outside taps + focus the actions (subtle blur) */}
      {(expanded || timerOpen) && (
        <div
          className="fixed inset-0 z-40 bg-black/5 dark:bg-black/20 backdrop-blur-[1px] animate-in fade-in duration-150 motion-reduce:animate-none"
          onClick={() => { setExpanded(false); setTimerOpen(false) }}
        />
      )}

      {/* Timer popover */}
      {timerOpen && (
        <PomodoroPanel
          open
          onClose={() => setTimerOpen(false)}
          className={cn('fixed z-50 bottom-[180px] md:bottom-24', anchorX)}
        />
      )}

      {/* Speed-dial */}
      <div className={cn('fixed z-50 bottom-[124px] md:bottom-6 flex flex-col items-end gap-2', anchorX)}>
        {expanded && (
          <>
            {/* When the desktop rail is docked, hide Ask AI on xl (chat is already there) — but keep it on mobile. */}
            <ActionPill label="Ask AI" onClick={askAi} delay={0} className={docked ? 'xl:hidden' : ''}>
              <MessageSquare size={18} />
            </ActionPill>
            <ActionPill label="Timer" onClick={openTimer} delay={40}>
              <Timer size={18} />
            </ActionPill>
          </>
        )}

        <button
          onClick={toggle}
          aria-label={expanded ? 'Close quick actions' : 'Quick actions'}
          aria-expanded={expanded}
          className={cn(
            'h-12 rounded-full shadow-lg flex items-center justify-center gap-1.5 transition-all duration-150 active:scale-90',
            running && !expanded ? 'px-3.5' : 'w-12',
            expanded ? 'bg-gray-800 dark:bg-gray-700 text-white rotate-45' : fabTint,
          )}
        >
          {expanded ? <Plus size={22} strokeWidth={2} /> : running ? (
            <>
              <Timer size={20} strokeWidth={2} />
              <span className="text-sm font-semibold tabular-nums">{timeText}</span>
            </>
          ) : (
            <Timer size={20} strokeWidth={2} />
          )}
        </button>
      </div>
    </>
  )
}

/** A labelled mini-action that springs in above the primary FAB. */
function ActionPill({ label, onClick, delay, children, className }: { label: string; onClick: () => void; delay: number; children: React.ReactNode; className?: string }) {
  return (
    <button
      onClick={onClick}
      style={{ animationDelay: `${delay}ms` }}
      className={cn('flex items-center gap-2.5 animate-in fade-in slide-in-from-bottom-2 duration-200 fill-mode-both motion-reduce:animate-none active:scale-95 transition-transform', className)}
    >
      <span className="text-xs font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-[#161B22] px-2.5 py-1.5 rounded-lg shadow-sm border border-gray-200 dark:border-[#30363D]">{label}</span>
      <span className="w-11 h-11 rounded-full bg-white dark:bg-[#161B22] text-brand-600 dark:text-brand-400 shadow-lg border border-gray-200 dark:border-[#30363D] flex items-center justify-center">{children}</span>
    </button>
  )
}
