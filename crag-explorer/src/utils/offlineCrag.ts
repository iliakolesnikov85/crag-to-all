import { CragData } from '../types';
import { computeCragDataChecksum } from './cragChecksum';
import { getCragDataUrl } from './firebaseStorage';
import {
  collectCragImageFiles,
  collectCragOfflineUrls,
  extractImageFileFromUrl,
  getOfflineCacheName,
  isOptionalOfflineUrl,
} from './offlineAssets';
import {
  deleteOfflineManifest,
  getOfflineManifest,
  putOfflineManifest,
} from './offlineManifestDb';
import { syncCragOpenTopoTiles } from './offlineOpenTopoTiles';

export interface OfflineProgress {
  done: number;
  total: number;
  label: string;
}

const CONCURRENCY = 4;

function enrichCragData(data: CragData): CragData {
  data.sectors.forEach((sector) => {
    sector.routes.forEach((route) => {
      route.sectorName = sector.name;
    });
  });
  return data;
}

async function fetchAndCache(
  cache: Cache,
  url: string,
): Promise<void> {
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) {
    if (isOptionalOfflineUrl(url) && response.status === 404) {
      await cache.delete(url);
      return;
    }
    throw new Error(`Failed to fetch ${url} (${response.status})`);
  }
  await cache.put(url, response.clone());
}

async function runWithConcurrency(
  urls: string[],
  cache: Cache,
  onProgress: (progress: OfflineProgress) => void,
  startDone: number,
  total: number,
): Promise<void> {
  let done = startDone;
  let index = 0;

  const worker = async () => {
    while (index < urls.length) {
      const i = index++;
      const url = urls[i];
      const label = url.split('/').pop()?.split('?')[0] ?? url;
      onProgress({ done, total, label });
      await fetchAndCache(cache, url);
      done++;
      onProgress({ done, total, label });
    }
  };

  const workers = Array.from(
    { length: Math.min(CONCURRENCY, urls.length) },
    () => worker(),
  );
  await Promise.all(workers);
}

export async function isCragOffline(cragId: string): Promise<boolean> {
  const manifest = await getOfflineManifest(cragId);
  return manifest !== undefined;
}

/** When online: true if saved pack differs from current Firebase JSON. */
export async function isOfflineDataOutdated(cragId: string): Promise<boolean> {
  const manifest = await getOfflineManifest(cragId);
  if (!manifest || !navigator.onLine) return false;

  // Legacy packs may lack jsonChecksum — treat as outdated so they re-sync.
  if (!manifest.jsonChecksum) return true;

  try {
    const response = await fetch(getCragDataUrl(cragId), { cache: 'no-store' });
    if (!response.ok) {
      throw new Error(`Failed to fetch crag data (${response.status})`);
    }
    const remoteChecksum = await computeCragDataChecksum(await response.json());
    return remoteChecksum !== manifest.jsonChecksum;
  } catch (error) {
    console.warn(
      `Could not compare remote checksum for crag "${cragId}", assuming up to date:`,
      error,
    );
    return false;
  }
}

/**
 * Download or refresh an offline pack. With no existing manifest this caches
 * everything; otherwise it only fetches changed/optional assets and prunes
 * removed images.
 */
export async function syncCragOffline(
  cragId: string,
  onProgress: (progress: OfflineProgress) => void,
): Promise<void> {
  const dataUrl = getCragDataUrl(cragId);
  const response = await fetch(dataUrl, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error('Failed to fetch latest crag data');
  }
  const rawData = await response.json();
  const jsonChecksum = await computeCragDataChecksum(rawData);
  const cragData = enrichCragData(rawData as CragData);

  const existing = await getOfflineManifest(cragId);
  const allUrls = collectCragOfflineUrls(cragId, cragData);
  const newImageFiles = new Set(collectCragImageFiles(cragData));
  const cache = await caches.open(getOfflineCacheName(cragId));
  const prevFiles = new Set(existing?.imageFiles ?? []);

  // Diff by filename only: image filenames are content-hashed, so any
  // change to an image produces a new filename. First download has an
  // empty prevFiles set, so every image is fetched.
  const toFetch: string[] = [];
  for (const url of allUrls) {
    if (url === dataUrl || isOptionalOfflineUrl(url)) {
      toFetch.push(url);
      continue;
    }
    const imageFile = extractImageFileFromUrl(url);
    if (imageFile && !prevFiles.has(imageFile)) {
      toFetch.push(url);
    }
  }

  const total = toFetch.length;
  onProgress({
    done: 0,
    total,
    label: existing ? 'Syncing…' : 'Starting…',
  });
  if (total > 0) {
    await runWithConcurrency(toFetch, cache, onProgress, 0, total);
  }

  if (existing) {
    for (const file of existing.imageFiles) {
      if (!newImageFiles.has(file)) {
        const imageUrl = allUrls.find((u) => {
          const extracted = extractImageFileFromUrl(u);
          return extracted === file;
        });
        if (imageUrl) await cache.delete(imageUrl);
      }
    }
  }

  // Non-fatal: tile hiccups must not fail the JSON/image sync users depend on.
  let opentopoTilePack = existing?.opentopoTilePack;
  try {
    const result = await syncCragOpenTopoTiles(
      cragId,
      cragData,
      existing?.opentopoTilePack,
      (tileProgress) => {
        onProgress({
          done: total + tileProgress.done,
          total: total + tileProgress.total,
          label: tileProgress.label,
        });
      },
    );
    if (result) opentopoTilePack = result;
  } catch (error) {
    console.warn(
      `OpenTopo tile sync failed for crag "${cragId}", keeping previous copy:`,
      error,
    );
  }

  const now = Date.now();
  await putOfflineManifest({
    cragId,
    cragName: cragData.name?.trim() || cragId,
    imageFiles: collectCragImageFiles(cragData),
    downloadedAt: existing?.downloadedAt ?? now,
    lastSyncedAt: now,
    jsonChecksum,
    opentopoTilePack,
  });
  notifyOfflineCragsChanged();
}

export async function removeCragOffline(cragId: string): Promise<void> {
  await caches.delete(getOfflineCacheName(cragId));
  await deleteOfflineManifest(cragId);
  notifyOfflineCragsChanged();
}

/** Load crag JSON for the app; falls back to the offline pack cache when needed. */
export async function loadCragDataJson(cragId: string): Promise<CragData> {
  const dataUrl = getCragDataUrl(cragId);

  try {
    const response = await fetch(dataUrl, {
      cache: navigator.onLine ? 'no-store' : 'default',
    });
    if (response.ok) {
      const raw = (await response.json()) as CragData;
      return enrichCragData(raw);
    }
  } catch (error) {
    console.warn(
      `Network fetch failed for crag "${cragId}", trying offline pack:`,
      error,
    );
  }

  const cache = await caches.open(getOfflineCacheName(cragId));
  const cached = await cache.match(dataUrl);
  if (cached?.ok) {
    const raw = (await cached.json()) as CragData;
    return enrichCragData(raw);
  }

  throw new Error('Failed to load crag data');
}

/** Sum byte sizes of responses in this crag's offline Cache Storage. */
export async function estimateCragOfflineSize(
  cragId: string,
): Promise<number | undefined> {
  if (!cragId || !('caches' in globalThis)) return undefined;
  const cacheName = getOfflineCacheName(cragId);
  const names = await caches.keys();
  if (!names.includes(cacheName)) return 0;

  const cache = await caches.open(cacheName);
  const requests = await cache.keys();
  let total = 0;

  for (const request of requests) {
    const response = await cache.match(request);
    if (!response) continue;

    const contentLength = response.headers.get('content-length');
    if (contentLength) {
      const parsed = Number(contentLength);
      if (Number.isFinite(parsed) && parsed >= 0) {
        total += parsed;
        continue;
      }
    }

    const blob = await response.clone().blob();
    total += blob.size;
  }

  return total;
}

export async function estimateStorage(): Promise<{
  usage?: number;
  quota?: number;
}> {
  if (!navigator.storage?.estimate) return {};
  const { usage, quota } = await navigator.storage.estimate();
  return { usage, quota };
}

export function notifyOfflineCragsChanged(): void {
  window.dispatchEvent(new Event('offline-crags-changed'));
}
