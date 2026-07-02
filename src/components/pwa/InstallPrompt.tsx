'use client'

import { useEffect, useState } from 'react'
import { Download, Share, X } from 'lucide-react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

function isStandalone() {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
}

export function InstallPrompt({ className }: { className?: string }) {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)
  const [installed, setInstalled] = useState(false)
  const [iosHint, setIosHint] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    // Client-only PWA capability detection on mount; these setStates are intentional.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (isStandalone()) { setInstalled(true); return }

    const onPrompt = (e: Event) => { e.preventDefault(); setDeferred(e as BeforeInstallPromptEvent) }
    const onInstalled = () => { setInstalled(true); setDeferred(null) }
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)

    // iOS Safari never fires beforeinstallprompt — show manual instructions there.
    const ua = window.navigator.userAgent
    const isIos = /iphone|ipad|ipod/i.test(ua)
    const isSafari = /safari/i.test(ua) && !/crios|fxios|edgios/i.test(ua)
    if (isIos && isSafari) setIosHint(true)

    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  if (installed || dismissed) return null

  if (deferred) {
    return (
      <button
        onClick={async () => { await deferred.prompt(); await deferred.userChoice; setDeferred(null) }}
        className={`inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-brand-600 text-white text-sm font-medium rounded-xl hover:bg-brand-800 transition-colors ${className ?? ''}`}
      >
        <Download size={16} /> Install app
      </button>
    )
  }

  if (iosHint) {
    return (
      <div className={`relative flex items-start gap-2 text-xs text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-[#1C2128] border border-gray-200 dark:border-[#30363D] rounded-xl px-3 py-2.5 ${className ?? ''}`}>
        <Share size={14} className="text-brand-600 flex-shrink-0 mt-0.5" />
        <span>Install: tap <strong>Share</strong> then <strong>Add to Home Screen</strong>.</span>
        <button onClick={() => setDismissed(true)} className="text-gray-400 hover:text-gray-600 flex-shrink-0"><X size={13} /></button>
      </div>
    )
  }

  return null
}
