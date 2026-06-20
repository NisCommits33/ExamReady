'use client'

import { createContext, useCallback, useContext, useRef, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface ConfirmOptions {
  title: string
  message?: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>
const ConfirmContext = createContext<ConfirmFn | null>(null)

/** Imperative confirm — `const confirm = useConfirm(); if (!(await confirm({...}))) return`. */
export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext)
  if (!ctx) throw new Error('useConfirm must be used inside <ConfirmProvider>')
  return ctx
}

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [opts, setOpts] = useState<ConfirmOptions | null>(null)
  const resolver = useRef<((v: boolean) => void) | null>(null)

  const confirm = useCallback<ConfirmFn>((options) => {
    return new Promise<boolean>(resolve => {
      resolver.current = resolve
      setOpts(options)
    })
  }, [])

  const close = (value: boolean) => {
    resolver.current?.(value)
    resolver.current = null
    setOpts(null)
  }

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {opts && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" onClick={() => close(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <div className="relative w-full max-w-sm bg-white dark:bg-[#161B22] border border-gray-200 dark:border-[#30363D] rounded-2xl p-5 shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-start gap-3">
              {opts.danger && (
                <div className="w-9 h-9 rounded-lg bg-red-50 dark:bg-red-900/20 flex items-center justify-center flex-shrink-0">
                  <AlertTriangle size={17} className="text-red-600 dark:text-red-400" />
                </div>
              )}
              <div className="min-w-0">
                <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{opts.title}</h2>
                {opts.message && <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{opts.message}</p>}
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button
                onClick={() => close(false)}
                className="text-sm font-medium text-gray-600 dark:text-gray-300 px-3 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-[#1C2128] transition-colors"
              >
                {opts.cancelLabel ?? 'Cancel'}
              </button>
              <button
                onClick={() => close(true)}
                autoFocus
                className={cn(
                  'text-sm font-medium text-white px-3 py-1.5 rounded-lg transition-colors',
                  opts.danger ? 'bg-red-600 hover:bg-red-700' : 'bg-brand-600 hover:bg-brand-800',
                )}
              >
                {opts.confirmLabel ?? 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  )
}
