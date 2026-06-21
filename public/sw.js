// LOKAI service worker — conservative offline support.
// Network-first for navigations (fresh content online, /offline fallback when down);
// cache-first for static assets. Never touches /api/* or /auth/*.
const CACHE = 'lokai-v1'
const OFFLINE_URL = '/offline'
const PRECACHE = [OFFLINE_URL, '/icon-192.png', '/icon-512.png']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/auth/')) return

  // Page navigations: network-first, fall back to the offline shell.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match(OFFLINE_URL).then((r) => r || Response.error())),
    )
    return
  }

  // Static assets: cache-first, then network (and cache the result).
  if (url.pathname.startsWith('/_next/static/') || /\.(png|svg|ico|woff2?|css|js)$/.test(url.pathname)) {
    event.respondWith(
      caches.match(request).then((cached) =>
        cached ||
        fetch(request).then((resp) => {
          const copy = resp.clone()
          caches.open(CACHE).then((c) => c.put(request, copy)).catch(() => {})
          return resp
        }).catch(() => cached),
      ),
    )
  }
})
