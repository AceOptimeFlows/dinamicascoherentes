/* OptimeFlow(s) Dinámicas Coherentes – Service Worker offline-first */
const VERSION = '2.2.0';
const CACHE_NAME = `optimeflow-dinamicas-coherentes-${VERSION}`;

const CORE_ASSETS = [
  './',
  './index.html',
  './styles.css',
  './i18n.js',
  './main.js',
  './manifest.webmanifest',
  './es.json',
  './lang/es.json',
  './assets/img/logo.png',
  './assets/img/dinamicacoherente192.png',
  './assets/img/dinamicacoherente512.png',
  './assets/img/dinamicacoherente180.png'
];

const LANGUAGE_ASSETS = [
  './lang/es.json',
  './lang/en.json',
  './lang/de.json',
  './lang/it.json',
  './lang/ca.json',
  './lang/pt-br.json',
  './lang/ko.json',
  './lang/ja.json',
  './lang/zh.json',
  './lang/fr.json',
  './lang/ru.json',
  './lang/hi.json'
];

const ROOT_COMPAT_LANGUAGE_ASSETS = [
  './es.json',
  './en.json',
  './de.json',
  './it.json',
  './ca.json',
  './pt-br.json',
  './ko.json',
  './ja.json',
  './zh.json',
  './fr.json',
  './ru.json',
  './hi.json'
];

const OPTIONAL_ASSETS = [
  ...LANGUAGE_ASSETS.filter((asset) => !CORE_ASSETS.includes(asset)),
  ...ROOT_COMPAT_LANGUAGE_ASSETS
];

const SCOPE_URL = new URL(self.registration.scope);
const INDEX_URL = new URL('./index.html', SCOPE_URL).toString();

function toAbsolute(url) {
  return new URL(url, SCOPE_URL).toString();
}

function cacheKeyFor(request) {
  const url = new URL(request.url);
  url.hash = '';

  if (url.origin === self.location.origin) {
    url.search = '';
  }

  if (request.mode === 'navigate') return INDEX_URL;
  return url.toString();
}

function isCacheableResponse(response) {
  return !!response && response.ok && (response.type === 'basic' || response.type === 'default');
}

async function cacheAsset(cache, asset, required = false) {
  try {
    const request = new Request(asset, { cache: 'reload' });
    const response = await fetch(request);
    if (!isCacheableResponse(response)) {
      if (required) throw new Error(`No cacheable: ${asset}`);
      return false;
    }
    await cache.put(toAbsolute(asset), response.clone());
    return true;
  } catch (error) {
    if (required) throw error;
    return false;
  }
}

async function precacheRequired(cache) {
  for (const asset of CORE_ASSETS) {
    await cacheAsset(cache, asset, true);
  }
}

async function precacheOptional(cache) {
  await Promise.allSettled(OPTIONAL_ASSETS.map((asset) => cacheAsset(cache, asset, false)));
}

async function warmLanguageAssets() {
  const cache = await caches.open(CACHE_NAME);
  const assets = [...new Set([...LANGUAGE_ASSETS, ...ROOT_COMPAT_LANGUAGE_ASSETS])];
  await Promise.allSettled(assets.map((asset) => cacheAsset(cache, asset, false)));
}

async function cleanupOldCaches() {
  const names = await caches.keys();
  await Promise.all(
    names.map((name) => (name !== CACHE_NAME ? caches.delete(name) : Promise.resolve(false)))
  );
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const key = cacheKeyFor(request);
  const cached = await cache.match(key);
  if (cached) return cached;

  const response = await fetch(request);
  if (isCacheableResponse(response)) {
    await cache.put(key, response.clone());
  }
  return response;
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);
  const key = cacheKeyFor(request);
  const cached = await cache.match(key);

  const networkPromise = fetch(request)
    .then(async (response) => {
      if (isCacheableResponse(response)) {
        await cache.put(key, response.clone());
      }
      return response;
    })
    .catch(() => null);

  if (cached) return cached;

  const fresh = await networkPromise;
  return fresh || Response.error();
}

async function networkFirstNavigation(event) {
  const cache = await caches.open(CACHE_NAME);
  const key = cacheKeyFor(event.request);

  try {
    const preload = await event.preloadResponse;
    if (preload) {
      if (isCacheableResponse(preload)) {
        await cache.put(key, preload.clone());
      }
      return preload;
    }

    const response = await fetch(event.request);
    if (isCacheableResponse(response)) {
      await cache.put(key, response.clone());
    }
    return response;
  } catch (_) {
    return (await cache.match(key)) || (await cache.match(INDEX_URL)) || Response.error();
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await precacheRequired(cache);
    await precacheOptional(cache);
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    await cleanupOldCaches();

    if ('navigationPreload' in self.registration) {
      try {
        await self.registration.navigationPreload.enable();
      } catch (_) {
        // Ignorado.
      }
    }

    await self.clients.claim();
    await warmLanguageAssets();
  })());
});

self.addEventListener('message', (event) => {
  if (!event.data || typeof event.data !== 'object') return;

  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
    return;
  }

  if (event.data.type === 'WARM_LANGS') {
    event.waitUntil(warmLanguageAssets());
  }
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  const isSameOrigin = url.origin === self.location.origin;
  const isInScope = url.pathname.startsWith(SCOPE_URL.pathname);

  if (!isSameOrigin || !isInScope) return;

  const acceptsHtml = (request.headers.get('accept') || '').includes('text/html');
  const isNavigation = request.mode === 'navigate' || acceptsHtml;

  if (isNavigation) {
    event.respondWith(networkFirstNavigation(event));
    return;
  }

  const destination = request.destination;
  const isStaticAsset = [
    'style',
    'script',
    'worker',
    'manifest',
    'font'
  ].includes(destination)
    || url.pathname.endsWith('.css')
    || url.pathname.endsWith('.js')
    || url.pathname.endsWith('.json');

  if (isStaticAsset) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  const isImage = destination === 'image' || /\.(png|jpg|jpeg|svg|webp|gif|ico)$/i.test(url.pathname);
  if (isImage) {
    event.respondWith(cacheFirst(request).catch(async () => {
      const cache = await caches.open(CACHE_NAME);
      return (await cache.match(cacheKeyFor(request))) || Response.error();
    }));
    return;
  }

  event.respondWith(staleWhileRevalidate(request));
});
