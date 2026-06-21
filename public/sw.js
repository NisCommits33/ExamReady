// LOKAI service worker — static-asset caching only.
// IMPORTANT: do NOT intercept page navigations. This app issues server redirects
// (/ -> /login or /admin); returning a redirected response for a navigation throws
// in Chrome ("No content available / was redirected"). So navigations go straight
// to the network and the browser handles redirects natively.
const CACHE = 'lokai-v2'

self.addEventListener('install', () => self.skipWaiting())

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
  if (request.mode === 'navigate') return // let the browser handle pages + redirects

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/auth/')) return

  // Static assets: cache-first, then network (and cache the result).
  if (url.pathname.startsWith('/_next/static/') || /\.(png|svg|ico|woff2?|css|js)$/.test(url.pathname)) {
    event.respondWith(
      caches.match(request).then((cached) =>
        cached ||
        fetch(request).then((resp) => {
          if (resp.ok && !resp.redirected) {
            const copy = resp.clone()
            caches.open(CACHE).then((c) => c.put(request, copy)).catch(() => {})
          }
          return resp
        }).catch(() => cached),
      ),
    )
  }
})
