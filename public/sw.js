// Andana service worker — app-shell + offline data caching.
//
// Strategy by request type (same-origin only; cross-origin map tiles are left
// to the network):
//   • navigations            → network-first, fall back to the cached shell
//   • /_next/static & assets  → cache-first (content-hashed, immutable)
//   • static data APIs        → stale-while-revalidate (instant, refresh in bg)
//   • other /api/*            → network-first, fall back to last-seen response
//
// Bump CACHE_VERSION to invalidate everything on a breaking change.
const CACHE_VERSION = 'andana-v1'
const SHELL_CACHE = `${CACHE_VERSION}-shell`
const ASSET_CACHE = `${CACHE_VERSION}-assets`
const DATA_CACHE  = `${CACHE_VERSION}-data`

// Precached on install so the app opens with no network at all.
const SHELL_URLS = ['/', '/logo.svg', '/icon-192.png', '/manifest.webmanifest']

// Static-ish data whose upstream changes rarely: caching these lets the planner
// and station search populate offline.
const STATIC_DATA = ['/api/stops', '/api/routes', '/api/plan-stations']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then((c) => c.addAll(SHELL_URLS))
      .then(() => self.skipWaiting())
      .catch(() => {}),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => !k.startsWith(CACHE_VERSION)).map((k) => caches.delete(k)),
      ))
      .then(() => self.clients.claim()),
  )
})

function isStaticData(pathname) {
  return STATIC_DATA.includes(pathname)
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(DATA_CACHE)
  const cached = await cache.match(request)
  const network = fetch(request)
    .then((res) => { if (res.ok) cache.put(request, res.clone()); return res })
    .catch(() => null)
  return cached || (await network) || Response.error()
}

async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName)
  try {
    const res = await fetch(request)
    if (res.ok) cache.put(request, res.clone())
    return res
  } catch {
    const cached = await cache.match(request)
    if (cached) return cached
    throw new Error('offline and uncached')
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(ASSET_CACHE)
  const cached = await cache.match(request)
  if (cached) return cached
  const res = await fetch(request)
  if (res.ok) cache.put(request, res.clone())
  return res
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  // Only handle our own origin; let map tiles etc. hit the network directly.
  if (url.origin !== self.location.origin) return

  // App navigations: prefer fresh HTML, fall back to the cached shell offline.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match('/', { cacheName: SHELL_CACHE }).then((r) => r || caches.match('/'))),
    )
    return
  }

  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      isStaticData(url.pathname) ? staleWhileRevalidate(request) : networkFirst(request, DATA_CACHE),
    )
    return
  }

  // Immutable build assets and static files.
  if (url.pathname.startsWith('/_next/static/') || /\.(?:js|css|woff2?|png|svg|ico|webmanifest)$/.test(url.pathname)) {
    event.respondWith(cacheFirst(request))
    return
  }
})
