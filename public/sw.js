const CACHE_NAME_PREFIX = 'dialista-'
const PRECACHE = 'dialista-precache-v1'
const RUNTIME = 'dialista-runtime-v1'

const CORE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/favicon.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-maskable-512.png',
  '/icons/apple-touch-icon.png',
]

/** Extrae los recursos con hash de /assets del HTML compilado. */
async function readBuildAssets() {
  const response = await fetch('/index.html', { cache: 'no-cache' })
  if (!response.ok) return []

  const html = await response.text()
  const assetPaths = new Set()
  const pattern = /(?:src|href)="(\/assets\/[^"]+)"/g
  let match

  while ((match = pattern.exec(html)) !== null) {
    assetPaths.add(match[1])
  }

  return [...assetPaths]
}

/** Elimina los assets con hash que ya no pertenecen a la compilación actual. */
async function pruneOldAssets(currentPaths) {
  for (const name of [PRECACHE, RUNTIME]) {
    const cache = await caches.open(name)
    for (const request of await cache.keys()) {
      const { pathname } = new URL(request.url)
      if (pathname.startsWith('/assets/') && !currentPaths.has(pathname)) {
        await cache.delete(request)
      }
    }
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const paths = [...CORE_ASSETS, ...(await readBuildAssets())]
      const cache = await caches.open(PRECACHE)

      await Promise.allSettled(
        paths.map((path) => cache.add(new Request(path, { cache: 'reload' }))),
      )
      await pruneOldAssets(new Set(paths))
      await self.skipWaiting()
    })(),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys()
      await Promise.all(
        names
          .filter(
            (name) =>
              name.startsWith(CACHE_NAME_PREFIX) &&
              name !== PRECACHE &&
              name !== RUNTIME,
          )
          .map((name) => caches.delete(name)),
      )
      await self.clients.claim()
    })(),
  )
})

function offlineFallback() {
  return new Response(
    '<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>DíaLista sin conexión</title><style>body{display:grid;place-content:center;min-height:100vh;margin:0;padding:24px;text-align:center;font-family:system-ui,sans-serif;color:#1d2923;background:#f3f0e8}h1{font-size:24px}p{max-width:34ch;color:#59645d}</style><h1>Sin conexión</h1><p>Abre DíaLista una vez con conexión para poder usar la copia guardada sin internet.</p></html>',
    {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    },
  )
}

async function networkFirstNavigation(request) {
  const cache = await caches.open(RUNTIME)

  try {
    const response = await fetch(request)
    if (response.ok) {
      await cache.put('/index.html', response.clone())
    }
    return response
  } catch {
    return (
      (await cache.match('/index.html')) ||
      (await caches.match('/index.html')) ||
      (await caches.match('/')) ||
      offlineFallback()
    )
  }
}

/** Busca también en la precarga: la primera visita deja los assets ahí. */
async function staleWhileRevalidate(event, request) {
  const cache = await caches.open(RUNTIME)
  const cached = await caches.match(request)

  const network = fetch(request)
    .then(async (response) => {
      if (response.ok && response.type === 'basic') {
        await cache.put(request, response.clone())
      }
      return response
    })
    .catch(() => null)

  if (cached) {
    event.waitUntil(network)
    return cached
  }

  return (await network) || Response.error()
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return
  if (url.pathname.startsWith('/api/')) return
  if (url.pathname === '/sw.js') return

  if (request.mode === 'navigate') {
    event.respondWith(networkFirstNavigation(request))
    return
  }

  event.respondWith(staleWhileRevalidate(event, request))
})
