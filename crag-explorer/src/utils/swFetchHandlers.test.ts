import { describe, expect, it, vi } from 'vitest';
import { SAMPLE_CRAG_ID } from '../test/fixtures/cragData';
import { getCragDataUrl, getCragOpenTopoTileUrl } from './firebaseStorage';
import { getOfflineCacheName } from './offline';
import {
  fetchFirebaseWithOfflineFallback,
  findCachedResponse,
  handleAppNavigation,
  isFirebaseStorageUrl,
} from './swFetchHandlers';

const ORIGIN = 'https://roshkaclimb.ge';

function navUrl(pathname: string): URL {
  return new URL(`${ORIGIN}${pathname}`);
}

describe('isFirebaseStorageUrl', () => {
  it('allows production Firebase Storage object URLs', () => {
    expect(
      isFirebaseStorageUrl(
        new URL('https://firebasestorage.googleapis.com/v0/b/bucket/o/file?alt=media'),
      ),
    ).toBe(true);
  });

  it('allows only the Storage emulator on localhost:9199', () => {
    expect(
      isFirebaseStorageUrl(new URL('http://localhost:9199/v0/b/bucket/o/file')),
    ).toBe(true);
    expect(
      isFirebaseStorageUrl(new URL('http://localhost:3005/v0/b/bucket/o/file')),
    ).toBe(false);
    expect(
      isFirebaseStorageUrl(new URL('http://localhost/v0/b/bucket/o/file')),
    ).toBe(false);
  });

  it('rejects hosts or paths that are not Firebase Storage objects', () => {
    expect(
      isFirebaseStorageUrl(new URL('https://example.com/v0/b/bucket/o/file')),
    ).toBe(false);
    expect(
      isFirebaseStorageUrl(
        new URL('https://firebasestorage.googleapis.com/v0/b/bucket/download'),
      ),
    ).toBe(false);
  });
});

describe('handleAppNavigation', () => {
  it('redirects offline non-root navigations to /', async () => {
    const response = await handleAppNavigation(navUrl('/test-crag/overview'), {
      online: false,
      fetchNavigation: () => Promise.reject(new Error('should not fetch')),
      matchShell: () => Promise.resolve(new Response('shell')),
    });

    expect(response.status).toBe(302);
    expect(response.headers.get('Location')).toBe(`${ORIGIN}/`);
  });

  it('serves the precached shell for offline root navigations', async () => {
    const shell = new Response('<html>shell</html>', { status: 200 });
    const response = await handleAppNavigation(navUrl('/'), {
      online: false,
      fetchNavigation: () => Promise.reject(new Error('should not fetch')),
      matchShell: async () => shell,
    });

    expect(await response.text()).toBe('<html>shell</html>');
  });

  it('uses the network first while online', async () => {
    const network = new Response('live', { status: 200 });
    const response = await handleAppNavigation(navUrl('/overview'), {
      online: true,
      fetchNavigation: async () => network,
      matchShell: () => Promise.resolve(new Response('shell')),
    });

    expect(await response.text()).toBe('live');
  });

  it('falls back to the precached shell when the navigation fetch fails', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const shell = new Response('shell', { status: 200 });
    const response = await handleAppNavigation(navUrl('/overview'), {
      online: true,
      fetchNavigation: () => Promise.reject(new Error('offline')),
      matchShell: async () => shell,
    });

    expect(await response.text()).toBe('shell');
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe('findCachedResponse and fetchFirebaseWithOfflineFallback', () => {
  it('reads only crag-offline caches', async () => {
    const url = getCragDataUrl(SAMPLE_CRAG_ID);
    const other = await caches.open('workbox-precache');
    await other.put(url, new Response('precached'));
    const pack = await caches.open(getOfflineCacheName(SAMPLE_CRAG_ID));
    await pack.put(url, new Response('pack'));

    const match = await findCachedResponse(new Request(url));
    expect(await match?.text()).toBe('pack');
  });

  it('serves the cached pack when offline', async () => {
    const request = new Request(getCragOpenTopoTileUrl(SAMPLE_CRAG_ID, 0, 0, 0));
    const cached = new Response('tile');
    const response = await fetchFirebaseWithOfflineFallback(request, cached, {
      online: false,
      fetchFromNetwork: () => Promise.reject(new Error('should not fetch')),
    });
    expect(await response.text()).toBe('tile');
  });

  it('returns a network error when offline with no cache', async () => {
    const request = new Request(getCragDataUrl(SAMPLE_CRAG_ID));
    const response = await fetchFirebaseWithOfflineFallback(request, undefined, {
      online: false,
      fetchFromNetwork: () => Promise.reject(new Error('should not fetch')),
    });
    expect(response.type).toBe('error');
  });

  it('uses cache when the online Firebase response is not ok', async () => {
    const request = new Request(getCragDataUrl(SAMPLE_CRAG_ID));
    const response = await fetchFirebaseWithOfflineFallback(
      request,
      new Response('cached-json'),
      {
        online: true,
        fetchFromNetwork: async () => new Response('missing', { status: 404 }),
      },
    );
    expect(await response.text()).toBe('cached-json');
  });

  it('uses cache when the online Firebase fetch throws', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const request = new Request(getCragDataUrl(SAMPLE_CRAG_ID));
    const response = await fetchFirebaseWithOfflineFallback(
      request,
      new Response('cached-json'),
      {
        online: true,
        fetchFromNetwork: () => Promise.reject(new Error('timeout')),
      },
    );
    expect(await response.text()).toBe('cached-json');
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('rethrows when the online Firebase fetch throws and nothing is cached', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const request = new Request(getCragDataUrl(SAMPLE_CRAG_ID));
    await expect(
      fetchFirebaseWithOfflineFallback(request, undefined, {
        online: true,
        fetchFromNetwork: () => Promise.reject(new Error('timeout')),
      }),
    ).rejects.toThrow('timeout');
    warn.mockRestore();
  });
});
