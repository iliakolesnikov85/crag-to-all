const FIREBASE_STORAGE_HOSTS = new Set([
  'firebasestorage.googleapis.com',
  'localhost',
]);

function isRootPath(pathname: string): boolean {
  return pathname === '/' || pathname === '';
}

export function isFirebaseStorageUrl(url: URL): boolean {
  if (!FIREBASE_STORAGE_HOSTS.has(url.hostname)) return false;
  if (url.hostname === 'localhost' && url.port !== '9199') return false;
  return url.pathname.includes('/o/');
}

export async function handleAppNavigation(
  url: URL,
  deps: {
    online: boolean;
    fetchNavigation: (href: string) => Promise<Response>;
    matchShell: () => Promise<Response | undefined>;
  },
): Promise<Response> {
  if (!deps.online) {
    if (!isRootPath(url.pathname)) {
      return Response.redirect(`${url.origin}/`, 302);
    }
    const shell = await deps.matchShell();
    return shell ?? Response.error();
  }
  try {
    return await deps.fetchNavigation(url.href);
  } catch (error) {
    console.warn('Navigation fetch failed, serving precached shell:', error);
    const shell = await deps.matchShell();
    return shell ?? Response.error();
  }
}

export async function findCachedResponse(
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

/**
 * Offline: serve saved pack only (or fail if missing).
 * Online: network first; on network failure use cache or rethrow if nothing saved.
 */
export async function fetchFirebaseWithOfflineFallback(
  request: Request,
  cached: Response | undefined,
  deps: {
    online: boolean;
    fetchFromNetwork: (request: Request) => Promise<Response>;
  },
): Promise<Response> {
  if (!deps.online) {
    if (cached) return cached;
    return Response.error();
  }

  try {
    const response = await deps.fetchFromNetwork(request);
    if (!response.ok && cached) return cached;
    return response;
  } catch (error) {
    if (cached) {
      console.warn('Firebase fetch failed, serving offline cache:', error);
      return cached;
    }
    console.warn('Firebase fetch failed with no offline cache:', error);
    throw error;
  }
}
