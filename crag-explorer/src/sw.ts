/// <reference lib="webworker" />
import { clientsClaim } from 'workbox-core';
import {
  addRoute,
  cleanupOutdatedCaches,
  matchPrecache,
  precache,
} from 'workbox-precaching';

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<{ url: string; revision: string | null }>;
};

// Required for vite-plugin-pwa registerType: 'autoUpdate' with injectManifest.
self.skipWaiting();
clientsClaim();

// Precache assets now; register the Workbox route after our fetch listener
// so online navigations are network-first instead of cache-first index.html.
precache(self.__WB_MANIFEST);
cleanupOutdatedCaches();

const FIREBASE_STORAGE_HOSTS = new Set([
  'firebasestorage.googleapis.com',
  'localhost',
]);

function isFirebaseStorageUrl(url: URL): boolean {
  if (!FIREBASE_STORAGE_HOSTS.has(url.hostname)) return false;
  if (url.hostname === 'localhost' && url.port !== '9199') return false;
  return url.pathname.includes('/o/');
}

function isRootPath(pathname: string): boolean {
  return pathname === '/' || pathname === '';
}

async function handleAppNavigation(url: URL): Promise<Response> {
  if (!self.navigator.onLine) {
    if (!isRootPath(url.pathname)) {
      return Response.redirect(`${url.origin}/`, 302);
    }
    const shell = await matchPrecache('index.html');
    return shell ?? Response.error();
  }
  try {
    return await fetch(url.href);
  } catch (error) {
    console.warn('Navigation fetch failed, serving precached shell:', error);
    const shell = await matchPrecache('index.html');
    return shell ?? Response.error();
  }
}

async function findCachedResponse(
  request: Request,
): Promise<Response | undefined> {
  const cacheNames = await caches.keys();
  for (const name of cacheNames) {
    if (!name.startsWith('crag-offline-')) continue;
    const cache = await caches.open(name);
    const match =
      (await cache.match(request)) ?? (await cache.match(request.url));
    if (match) return match;
  }
  return undefined;
}

/** In-flight network fetches started by this SW — bypass handler to avoid fetch recursion. */
const pendingNetworkFetches = new Map<string, number>();

function isBypassNetworkFetch(url: string): boolean {
  return (pendingNetworkFetches.get(url) ?? 0) > 0;
}

function beginNetworkFetch(url: string): void {
  pendingNetworkFetches.set(url, (pendingNetworkFetches.get(url) ?? 0) + 1);
}

function endNetworkFetch(url: string): void {
  const count = (pendingNetworkFetches.get(url) ?? 1) - 1;
  if (count <= 0) pendingNetworkFetches.delete(url);
  else pendingNetworkFetches.set(url, count);
}

/** Network fetch that does not re-enter this service worker's fetch handler. */
async function fetchFromNetwork(request: Request): Promise<Response> {
  const url = request.url;
  beginNetworkFetch(url);
  try {
    return await fetch(request);
  } finally {
    endNetworkFetch(url);
  }
}

/**
 * Offline: serve saved pack only (or fail if missing).
 * Online: network first; on network failure use cache or rethrow if nothing saved.
 */
async function fetchFirebaseWithOfflineFallback(
  request: Request,
  cached: Response | undefined,
): Promise<Response> {
  if (!self.navigator.onLine) {
    if (cached) return cached;
    return Response.error();
  }

  try {
    const response = await fetchFromNetwork(request);
    if (!response.ok && cached) return cached;
    return response;
  } catch (error) {
    if (cached) return cached;
    throw error;
  }
}

self.addEventListener('fetch', (event: FetchEvent) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  if (event.request.mode === 'navigate' && url.origin === self.location.origin) {
    event.respondWith(handleAppNavigation(url));
    return;
  }

  if (!isFirebaseStorageUrl(url)) return;

  if (isBypassNetworkFetch(event.request.url)) return;

  event.respondWith(
    (async () => {
      const cached = await findCachedResponse(event.request);
      return fetchFirebaseWithOfflineFallback(event.request, cached);
    })(),
  );
});

// After our listener so navigations are not answered from the precache.
addRoute();
