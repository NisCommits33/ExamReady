'use client'

import { BookOpenText, X } from 'lucide-react'

/** "Continue where you left off" banner shown at the top of a reading view. */
export function ResumeBanner({ onContinue, onDismiss }: { onContinue: () => void; onDismiss: () => void }) {
  return (
    <button
      onClick={onContinue}
      className="w-full mb-4 flex items-center justify-between gap-3 px-4 py-3 bg-brand-50 dark:bg-brand-900/20 border border-brand-200 dark:border-brand-800 rounded-xl text-left hover:bg-brand-100 dark:hover:bg-brand-900/30 transition-colors active:scale-[0.99]"
    >
      <div className="flex items-center gap-2.5">
        <BookOpenText size={18} className="text-brand-600 flex-shrink-0" />
        <div>
          <p className="text-sm font-medium text-brand-800 dark:text-brand-200">Continue where you left off</p>
          <p className="text-xs text-brand-600/80 dark:text-brand-300/80">Jump back to your last spot</p>
        </div>
      </div>
      <span
        role="button"
        tabIndex={-1}
        onClick={(e) => { e.stopPropagation(); onDismiss() }}
        className="p-1 rounded-md text-brand-500/70 hover:text-brand-700 hover:bg-brand-200/50 dark:hover:bg-brand-800/50 transition-colors"
        aria-label="Dismiss"
      >
        <X size={15} />
      </span>
    </button>
  )
}
