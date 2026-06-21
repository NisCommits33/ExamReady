'use client'

import { useEffect } from 'react'

/** Registers the service worker in production only (avoids dev caching headaches). */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return
    if (!('serviceWorker' in navigator)) return
    // Register now — the effect already runs after hydration, so don't wait on
    // window 'load' (it has usually fired by then, which would skip registration).
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  }, [])
  return null
}
