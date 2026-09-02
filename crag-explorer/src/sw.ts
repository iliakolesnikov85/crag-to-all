/// <reference lib="webworker" />
import { clientsClaim } from 'workbox-core';
import {
  addRoute,
  cleanupOutdatedCaches,
  matchPrecache,
  precache,
} from 'workbox-precaching';
import {
  fetchFirebaseWithOfflineFallback,
  findCachedResponse,
  handleAppNavigation,
  isFirebaseStorageUrl,
} from './utils/swFetchHandlers';

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

self.addEventListener('fetch', (event: FetchEvent) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  if (event.request.mode === 'navigate' && url.origin === self.location.origin) {
    event.respondWith(
      handleAppNavigation(url, {
        online: self.navigator.onLine,
        fetchNavigation: (href) => fetch(href),
        matchShell: () => matchPrecache('index.html'),
      }),
    );
    return;
  }

  if (!isFirebaseStorageUrl(url)) return;

  if (isBypassNetworkFetch(event.request.url)) return;

  event.respondWith(
    (async () => {
      const cached = await findCachedResponse(event.request);
      return fetchFirebaseWithOfflineFallback(event.request, cached, {
        online: self.navigator.onLine,
        fetchFromNetwork,
      });
    })(),
  );
});

// After our listener so navigations are not answered from the precache.
addRoute();
