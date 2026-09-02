import { webcrypto } from 'node:crypto';
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { IDBFactory } from 'fake-indexeddb';
import { afterEach, vi } from 'vitest';

const UNMOCKED_FETCH = 'fetch is not mocked in tests';

function requestUrl(request: RequestInfo | URL): string {
  if (typeof request === 'string') return request;
  if (request instanceof URL) return request.href;
  return request.url;
}

class MemoryCache implements Cache {
  #store = new Map<string, Response>();

  async match(request: RequestInfo | URL): Promise<Response | undefined> {
    const cached = this.#store.get(requestUrl(request));
    return cached ? cached.clone() : undefined;
  }

  async matchAll(request?: RequestInfo | URL): Promise<ReadonlyArray<Response>> {
    if (request === undefined) {
      return [...this.#store.values()].map((response) => response.clone());
    }
    const match = await this.match(request);
    return match ? [match] : [];
  }

  async add(): Promise<void> {
    throw new Error('Cache.add is not implemented in tests');
  }

  async addAll(): Promise<void> {
    throw new Error('Cache.addAll is not implemented in tests');
  }

  async put(request: RequestInfo | URL, response: Response): Promise<void> {
    this.#store.set(requestUrl(request), response.clone());
  }

  async delete(request: RequestInfo | URL): Promise<boolean> {
    return this.#store.delete(requestUrl(request));
  }

  async keys(): Promise<ReadonlyArray<Request>> {
    return [...this.#store.keys()].map((url) => new Request(url));
  }
}

class MemoryCacheStorage implements CacheStorage {
  #caches = new Map<string, MemoryCache>();

  async match(request: RequestInfo | URL): Promise<Response | undefined> {
    for (const cache of this.#caches.values()) {
      const match = await cache.match(request);
      if (match) return match;
    }
    return undefined;
  }

  async has(cacheName: string): Promise<boolean> {
    return this.#caches.has(cacheName);
  }

  async delete(cacheName: string): Promise<boolean> {
    return this.#caches.delete(cacheName);
  }

  async keys(): Promise<string[]> {
    return [...this.#caches.keys()];
  }

  async open(cacheName: string): Promise<Cache> {
    let cache = this.#caches.get(cacheName);
    if (!cache) {
      cache = new MemoryCache();
      this.#caches.set(cacheName, cache);
    }
    return cache;
  }

  async clear(): Promise<void> {
    this.#caches.clear();
  }
}

const cacheStorage = new MemoryCacheStorage();
const fetchMock = vi.fn(() => Promise.reject(new Error(UNMOCKED_FETCH)));

if (!globalThis.crypto?.subtle) {
  Object.defineProperty(globalThis, 'crypto', {
    value: webcrypto,
    configurable: true,
  });
}

vi.stubGlobal('caches', cacheStorage);
vi.stubGlobal('fetch', fetchMock);
globalThis.indexedDB = new IDBFactory();

if (!window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}

if (!window.scrollTo) {
  Object.defineProperty(window, 'scrollTo', {
    configurable: true,
    writable: true,
    value: () => {},
  });
}

afterEach(async () => {
  cleanup();
  vi.unstubAllGlobals();
  fetchMock.mockReset();
  fetchMock.mockImplementation(() => Promise.reject(new Error(UNMOCKED_FETCH)));
  vi.stubGlobal('caches', cacheStorage);
  vi.stubGlobal('fetch', fetchMock);
  await cacheStorage.clear();
  globalThis.indexedDB = new IDBFactory();
  Object.defineProperty(navigator, 'onLine', {
    configurable: true,
    value: true,
  });
});
