import { zipSync } from 'fflate';
import { describe, expect, it, vi } from 'vitest';
import type { OpenTopoTilePackInfo } from '../../types';
import { SAMPLE_CRAG_ID, sampleCragData } from '../../test/fixtures/cragData';
import { requestUrl } from '../../test/helpers';
import { getCragOpenTopoPackUrl, getCragOpenTopoTileUrl } from '../firebaseStorage';
import { getOfflineCacheName } from './offlineAssets';
import { syncCragOpenTopoTiles } from './offlineOpenTopoTiles';

const PNG_MAGIC = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);

function pack(overrides: Partial<OpenTopoTilePackInfo> = {}): OpenTopoTilePackInfo {
  return {
    bbox: [0, 0, 0, 0],
    zoomMin: 0,
    zoomMax: 0,
    packVersion: 3,
    fetchedAt: 1_700_000_000_000,
    tileCount: 1,
    totalBytes: PNG_MAGIC.byteLength,
    archiveBytes: 64,
    ...overrides,
  };
}

function zipResponse(entries: Record<string, Uint8Array>): Response {
  const bytes = zipSync(entries);
  return new Response(bytes, {
    status: 200,
    headers: {
      'Content-Type': 'application/zip',
      'Content-Length': String(bytes.byteLength),
    },
  });
}

function mockPackDownload(response: Response): void {
  vi.mocked(fetch).mockImplementation((input) => {
    const url = requestUrl(input);
    if (url === getCragOpenTopoPackUrl(SAMPLE_CRAG_ID)) {
      return Promise.resolve(response);
    }
    return Promise.reject(new Error(`unexpected fetch: ${url}`));
  });
}

describe('syncCragOpenTopoTiles', () => {
  it('skips download when the local pack matches Firebase metadata', async () => {
    const remote = pack();
    const data = { ...structuredClone(sampleCragData), opentopoTilePack: remote };

    const result = await syncCragOpenTopoTiles(SAMPLE_CRAG_ID, data, remote);

    expect(result).toEqual(remote);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('unzips pack entries into synthetic Firebase tile cache keys', async () => {
    const remote = pack();
    const data = { ...structuredClone(sampleCragData), opentopoTilePack: remote };
    mockPackDownload(zipResponse({ '0/0/0.png': PNG_MAGIC }));
    const staleUrl = getCragOpenTopoTileUrl(SAMPLE_CRAG_ID, 15, 1, 2);
    const cache = await caches.open(getOfflineCacheName(SAMPLE_CRAG_ID));
    await cache.put(staleUrl, new Response('old'));

    const result = await syncCragOpenTopoTiles(SAMPLE_CRAG_ID, data, undefined);

    const tileUrl = getCragOpenTopoTileUrl(SAMPLE_CRAG_ID, 0, 0, 0);
    const cached = await cache.match(tileUrl);
    expect(cached).toBeDefined();
    expect(cached?.headers.get('Content-Type')).toBe('image/png');
    expect(await cache.match(staleUrl)).toBeUndefined();
    expect(result).toEqual({ ...remote, tileCount: 1 });
  });

  it('does not prune existing tiles when unpack is incomplete', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const remote = pack({ tileCount: 2 });
    const data = { ...structuredClone(sampleCragData), opentopoTilePack: remote };
    mockPackDownload(zipResponse({ '0/0/0.png': PNG_MAGIC }));
    const staleUrl = getCragOpenTopoTileUrl(SAMPLE_CRAG_ID, 15, 1, 2);
    const cache = await caches.open(getOfflineCacheName(SAMPLE_CRAG_ID));
    await cache.put(staleUrl, new Response('old'));

    const result = await syncCragOpenTopoTiles(SAMPLE_CRAG_ID, data, undefined);

    expect(await cache.match(staleUrl)).toBeDefined();
    expect(result?.tileCount).toBe(1);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('throws when the pack contains no unpackable tiles', async () => {
    const remote = pack({ tileCount: 4 });
    const data = { ...structuredClone(sampleCragData), opentopoTilePack: remote };
    mockPackDownload(zipResponse({ 'readme.txt': new Uint8Array([1, 2, 3]) }));

    await expect(
      syncCragOpenTopoTiles(SAMPLE_CRAG_ID, data, undefined),
    ).rejects.toThrow('no tiles could be unpacked from pack');
  });
});
