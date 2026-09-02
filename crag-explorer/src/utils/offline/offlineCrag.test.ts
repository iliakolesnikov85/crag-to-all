import { describe, expect, it, vi } from 'vitest';
import type { CragData } from '../../types';
import {
  SAMPLE_CRAG_ID,
  SAMPLE_IMAGE_FILE,
  sampleCragData,
} from '../../test/fixtures/cragData';
import { jsonResponse, okResponse, requestUrl, setNavigatorOnLine } from '../../test/helpers';
import { computeCragDataChecksum } from '../cragChecksum';
import {
  getCragDataUrl,
  getCragImageUrl,
  getCragOpenTopoPackUrl,
  getCragSectorsGpxUrl,
} from '../firebaseStorage';
import { collectCragImageFiles, getOfflineCacheName } from './offlineAssets';
import {
  estimateCragOfflineSize,
  isCragOffline,
  isOfflineDataOutdated,
  loadCragDataJson,
  removeCragOffline,
  syncCragOffline,
} from './offlineCrag';
import { getOfflineManifest, putOfflineManifest } from './offlineManifestDb';

const STALE_IMAGE_FILE = 'old.jpg';
const NEW_IMAGE_FILE = 'new-hash.jpg';

function mockSyncFetches(
  data: CragData,
  options: {
    gpxStatus?: number;
    extra?: (url: string) => Promise<Response> | null;
  } = {},
): string[] {
  const fetched: string[] = [];
  const imageFiles = collectCragImageFiles(data);
  vi.mocked(fetch).mockImplementation((input) => {
    const url = requestUrl(input);
    fetched.push(url);
    const extra = options.extra?.(url);
    if (extra) return extra;
    if (url === getCragDataUrl(SAMPLE_CRAG_ID)) {
      return Promise.resolve(jsonResponse(data));
    }
    if (url === getCragSectorsGpxUrl(SAMPLE_CRAG_ID)) {
      const status = options.gpxStatus ?? 200;
      return Promise.resolve(new Response(status === 200 ? 'gpx' : 'missing', { status }));
    }
    if (imageFiles.some((file) => url === getCragImageUrl(SAMPLE_CRAG_ID, file))) {
      return Promise.resolve(okResponse('img'));
    }
    return Promise.reject(new Error(`unexpected fetch: ${url}`));
  });
  return fetched;
}

async function seedCachedJson(data: CragData = sampleCragData): Promise<void> {
  const cache = await caches.open(getOfflineCacheName(SAMPLE_CRAG_ID));
  await cache.put(getCragDataUrl(SAMPLE_CRAG_ID), jsonResponse(data));
}

describe('loadCragDataJson', () => {
  it('returns network JSON and fills route sector names', async () => {
    const remote = structuredClone(sampleCragData);
    remote.sectors[0].routes[0].sectorName = '';
    vi.mocked(fetch).mockResolvedValue(jsonResponse(remote));

    const data = await loadCragDataJson(SAMPLE_CRAG_ID);

    expect(data.name).toBe('Test Crag');
    expect(data.sectors[0].routes[0].sectorName).toBe('Main Wall');
    expect(fetch).toHaveBeenCalledWith(getCragDataUrl(SAMPLE_CRAG_ID), {
      cache: 'no-store',
    });
  });

  it('falls back to the offline pack when the network request fails', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await seedCachedJson();
    vi.mocked(fetch).mockRejectedValue(new Error('offline'));

    const data = await loadCragDataJson(SAMPLE_CRAG_ID);

    expect(data.name).toBe('Test Crag');
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('falls back to the offline pack when the network response is not ok', async () => {
    await seedCachedJson();
    vi.mocked(fetch).mockResolvedValue(new Response('nope', { status: 503 }));

    const data = await loadCragDataJson(SAMPLE_CRAG_ID);

    expect(data.sectors).toHaveLength(2);
  });

  it('throws when both network and the offline pack fail', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.mocked(fetch).mockRejectedValue(new Error('offline'));

    await expect(loadCragDataJson(SAMPLE_CRAG_ID)).rejects.toThrow(
      'Failed to load crag data',
    );
    warn.mockRestore();
  });
});

describe('isOfflineDataOutdated', () => {
  it('returns false when there is no manifest', async () => {
    expect(await isOfflineDataOutdated(SAMPLE_CRAG_ID)).toBe(false);
  });

  it('returns false while the browser is offline', async () => {
    await putOfflineManifest({
      cragId: SAMPLE_CRAG_ID,
      cragName: 'Test Crag',
      imageFiles: [],
      downloadedAt: 1,
      lastSyncedAt: 1,
      jsonChecksum: 'abc',
    });
    setNavigatorOnLine(false);

    expect(await isOfflineDataOutdated(SAMPLE_CRAG_ID)).toBe(false);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('treats a legacy pack without jsonChecksum as outdated', async () => {
    await putOfflineManifest({
      cragId: SAMPLE_CRAG_ID,
      cragName: 'Test Crag',
      imageFiles: [],
      downloadedAt: 1,
      lastSyncedAt: 1,
      jsonChecksum: '',
    });

    expect(await isOfflineDataOutdated(SAMPLE_CRAG_ID)).toBe(true);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('returns true when the remote checksum differs', async () => {
    await putOfflineManifest({
      cragId: SAMPLE_CRAG_ID,
      cragName: 'Test Crag',
      imageFiles: [],
      downloadedAt: 1,
      lastSyncedAt: 1,
      jsonChecksum: 'stale-checksum',
    });
    vi.mocked(fetch).mockResolvedValue(jsonResponse(sampleCragData));

    expect(await isOfflineDataOutdated(SAMPLE_CRAG_ID)).toBe(true);
  });

  it('returns false when the remote checksum matches', async () => {
    const jsonChecksum = await computeCragDataChecksum(sampleCragData);
    await putOfflineManifest({
      cragId: SAMPLE_CRAG_ID,
      cragName: 'Test Crag',
      imageFiles: [],
      downloadedAt: 1,
      lastSyncedAt: 1,
      jsonChecksum,
    });
    vi.mocked(fetch).mockResolvedValue(jsonResponse(sampleCragData));

    expect(await isOfflineDataOutdated(SAMPLE_CRAG_ID)).toBe(false);
  });

  it('assumes up to date when the remote checksum fetch fails', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await putOfflineManifest({
      cragId: SAMPLE_CRAG_ID,
      cragName: 'Test Crag',
      imageFiles: [],
      downloadedAt: 1,
      lastSyncedAt: 1,
      jsonChecksum: 'abc',
    });
    vi.mocked(fetch).mockRejectedValue(new Error('timeout'));

    expect(await isOfflineDataOutdated(SAMPLE_CRAG_ID)).toBe(false);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe('syncCragOffline', () => {
  it('caches JSON, GPX, and images on the first download', async () => {
    mockSyncFetches(structuredClone(sampleCragData));

    await syncCragOffline(SAMPLE_CRAG_ID, () => {});

    const cache = await caches.open(getOfflineCacheName(SAMPLE_CRAG_ID));
    expect(await cache.match(getCragDataUrl(SAMPLE_CRAG_ID))).toBeDefined();
    expect(await cache.match(getCragSectorsGpxUrl(SAMPLE_CRAG_ID))).toBeDefined();
    expect(
      await cache.match(getCragImageUrl(SAMPLE_CRAG_ID, SAMPLE_IMAGE_FILE)),
    ).toBeDefined();
    const manifest = await getOfflineManifest(SAMPLE_CRAG_ID);
    expect(manifest?.cragName).toBe('Test Crag');
    expect(manifest?.imageFiles).toEqual([SAMPLE_IMAGE_FILE]);
    expect(manifest?.jsonChecksum).toHaveLength(64);
    expect(await isCragOffline(SAMPLE_CRAG_ID)).toBe(true);
  });

  it('skips images whose hashed filenames are already in the manifest', async () => {
    mockSyncFetches(structuredClone(sampleCragData));
    await syncCragOffline(SAMPLE_CRAG_ID, () => {});

    const data = structuredClone(sampleCragData);
    data.sectors[0].images.push({ imageFile: NEW_IMAGE_FILE });
    const fetched = mockSyncFetches(data);
    await syncCragOffline(SAMPLE_CRAG_ID, () => {});

    expect(fetched).toContain(getCragDataUrl(SAMPLE_CRAG_ID));
    expect(fetched).toContain(getCragSectorsGpxUrl(SAMPLE_CRAG_ID));
    expect(fetched).toContain(getCragImageUrl(SAMPLE_CRAG_ID, NEW_IMAGE_FILE));
    expect(fetched).not.toContain(getCragImageUrl(SAMPLE_CRAG_ID, SAMPLE_IMAGE_FILE));
  });

  it('does not fail the pack when optional GPX is 404', async () => {
    mockSyncFetches(structuredClone(sampleCragData), { gpxStatus: 404 });
    const gpxUrl = getCragSectorsGpxUrl(SAMPLE_CRAG_ID);
    const cache = await caches.open(getOfflineCacheName(SAMPLE_CRAG_ID));
    await cache.put(gpxUrl, okResponse('old-gpx'));

    await syncCragOffline(SAMPLE_CRAG_ID, () => {});

    expect(await cache.match(gpxUrl)).toBeUndefined();
    expect(await isCragOffline(SAMPLE_CRAG_ID)).toBe(true);
  });

  it('deletes cached images that were removed from crag data', async () => {
    const staleUrl = getCragImageUrl(SAMPLE_CRAG_ID, STALE_IMAGE_FILE);
    const keepUrl = getCragImageUrl(SAMPLE_CRAG_ID, SAMPLE_IMAGE_FILE);
    const cache = await caches.open(getOfflineCacheName(SAMPLE_CRAG_ID));
    await cache.put(staleUrl, okResponse('stale'));
    await cache.put(keepUrl, okResponse('keep'));
    await putOfflineManifest({
      cragId: SAMPLE_CRAG_ID,
      cragName: 'Test Crag',
      imageFiles: [STALE_IMAGE_FILE, SAMPLE_IMAGE_FILE],
      downloadedAt: 1,
      lastSyncedAt: 1,
      jsonChecksum: 'previous',
    });

    mockSyncFetches(structuredClone(sampleCragData));
    await syncCragOffline(SAMPLE_CRAG_ID, () => {});

    expect(await cache.match(staleUrl)).toBeUndefined();
    expect(await cache.match(keepUrl)).toBeDefined();
    const manifest = await getOfflineManifest(SAMPLE_CRAG_ID);
    expect(manifest?.imageFiles).toEqual([SAMPLE_IMAGE_FILE]);
  });

  it('keeps the JSON/image pack when OpenTopo sync throws', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const data = structuredClone(sampleCragData);
    data.opentopoTilePack = {
      bbox: [0, 0, 0, 0],
      zoomMin: 0,
      zoomMax: 0,
      packVersion: 3,
      fetchedAt: 1,
      tileCount: 1,
      totalBytes: 8,
      archiveBytes: 10,
    };
    const previousPack = { ...data.opentopoTilePack, fetchedAt: 0 };
    await putOfflineManifest({
      cragId: SAMPLE_CRAG_ID,
      cragName: 'Test Crag',
      imageFiles: [SAMPLE_IMAGE_FILE],
      downloadedAt: 1,
      lastSyncedAt: 1,
      jsonChecksum: 'previous',
      opentopoTilePack: previousPack,
    });
    mockSyncFetches(data, {
      extra: (url) => {
        if (url === getCragOpenTopoPackUrl(SAMPLE_CRAG_ID)) {
          return Promise.resolve(new Response('nope', { status: 500 }));
        }
        return null;
      },
    });

    await syncCragOffline(SAMPLE_CRAG_ID, () => {});

    const manifest = await getOfflineManifest(SAMPLE_CRAG_ID);
    expect(manifest?.jsonChecksum).toHaveLength(64);
    expect(manifest?.opentopoTilePack).toEqual(previousPack);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe('removeCragOffline and estimateCragOfflineSize', () => {
  it('returns undefined for an empty crag id', async () => {
    expect(await estimateCragOfflineSize('')).toBeUndefined();
  });

  it('returns 0 when the crag cache does not exist', async () => {
    expect(await estimateCragOfflineSize(SAMPLE_CRAG_ID)).toBe(0);
  });

  it('sums content-length headers and falls back to blob size', async () => {
    const cache = await caches.open(getOfflineCacheName(SAMPLE_CRAG_ID));
    await cache.put(
      'https://example.com/a',
      okResponse('abcd', { headers: { 'content-length': '4' } }),
    );
    await cache.put('https://example.com/b', okResponse('xyz'));

    expect(await estimateCragOfflineSize(SAMPLE_CRAG_ID)).toBe(4 + 3);
  });

  it('deletes the cache and manifest', async () => {
    mockSyncFetches(structuredClone(sampleCragData));
    await syncCragOffline(SAMPLE_CRAG_ID, () => {});
    expect(await isCragOffline(SAMPLE_CRAG_ID)).toBe(true);

    await removeCragOffline(SAMPLE_CRAG_ID);

    expect(await isCragOffline(SAMPLE_CRAG_ID)).toBe(false);
    expect(await getOfflineManifest(SAMPLE_CRAG_ID)).toBeUndefined();
    expect(await caches.has(getOfflineCacheName(SAMPLE_CRAG_ID))).toBe(false);
    expect(await estimateCragOfflineSize(SAMPLE_CRAG_ID)).toBe(0);
  });
});
