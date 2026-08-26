/**
 * Offline OpenTopoMap raster tiles: download a single ZIP pack from Firebase
 * Storage, unpack PNGs into the crag offline Cache Storage, and serve them
 * as a Leaflet layer (synthetic per-tile Firebase URLs as cache keys).
 */
import { unzip } from 'fflate';
import * as L from 'leaflet';
import {
  tilesForBbox,
  type BBox,
  type OpenTopoTilePackInfo,
} from '@crag-to-all/shared-crag';
import { CragData } from '../types';
import {
  getCragOpenTopoPackUrl,
  getCragOpenTopoTileUrl,
} from './firebaseStorage';
import { getOfflineCacheName } from './offlineAssets';
import { getOfflineManifest } from './offlineManifestDb';

function tupleToBbox(tuple: [number, number, number, number]): BBox {
  return {
    south: tuple[0],
    west: tuple[1],
    north: tuple[2],
    east: tuple[3],
  };
}

function bboxEqual(
  a: [number, number, number, number],
  b: [number, number, number, number],
): boolean {
  return a[0] === b[0] && a[1] === b[1] && a[2] === b[2] && a[3] === b[3];
}

/**
 * True when the local manifest pack still matches the Firebase pack metadata.
 * `fetchedAt` is the pack upload time from crag JSON (not client download time),
 * so a regenerates-same-bbox pack is detected as outdated.
 */
function isLocalPackCurrent(
  local: OpenTopoTilePackInfo,
  remote: OpenTopoTilePackInfo,
): boolean {
  return (
    bboxEqual(local.bbox, remote.bbox) &&
    local.zoomMin === remote.zoomMin &&
    local.zoomMax === remote.zoomMax &&
    local.packVersion === remote.packVersion &&
    local.fetchedAt === remote.fetchedAt &&
    local.tileCount === remote.tileCount &&
    local.totalBytes === remote.totalBytes &&
    local.archiveBytes === remote.archiveBytes
  );
}

function isOpenTopoTileUrl(url: string, cragId: string): boolean {
  const marker = encodeURIComponent(`${cragId}/tiles/opentopo/`);
  return url.includes(marker) || url.includes(`${cragId}/tiles/opentopo/`);
}

/** Parse `z/x/y.png` (or with leading folders) into tile coords. */
function parseTileEntryPath(
  path: string,
): { z: number; x: number; y: number } | null {
  const normalized = path.replace(/^\/+/, '');
  const match = normalized.match(/(?:^|\/)(\d+)\/(\d+)\/(\d+)\.png$/i);
  if (!match) return null;
  return {
    z: Number(match[1]),
    x: Number(match[2]),
    y: Number(match[3]),
  };
}

function unzipAsync(
  data: Uint8Array,
): Promise<Record<string, Uint8Array>> {
  return new Promise((resolve, reject) => {
    unzip(data, (err, result) => {
      if (err) reject(err);
      else resolve(result);
    });
  });
}

async function readResponseBytes(
  response: Response,
  onProgress?: (received: number, total: number | null) => void,
): Promise<Uint8Array> {
  const totalHeader = response.headers.get('Content-Length');
  const total = totalHeader ? Number(totalHeader) : null;
  if (!response.body) {
    const buffer = await response.arrayBuffer();
    onProgress?.(buffer.byteLength, total ?? buffer.byteLength);
    return new Uint8Array(buffer);
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      received += value.length;
      onProgress?.(received, total);
    }
  }

  const out = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

export interface OfflineTileSyncProgress {
  done: number;
  total: number;
  label: string;
}

/**
 * Download OpenTopo ZIP from Firebase into Cache Storage when the local pack
 * is missing from the manifest, or when Firebase pack metadata is newer/different.
 * Throws only when fetches fail badly enough that no usable pack remains.
 */
export async function syncCragOpenTopoTiles(
  cragId: string,
  cragData: CragData,
  existingPack: OpenTopoTilePackInfo | undefined,
  onProgress?: (progress: OfflineTileSyncProgress) => void,
): Promise<OpenTopoTilePackInfo | undefined> {
  const remote = cragData.opentopoTilePack;
  if (!remote) return undefined;

  // Manifest already has a pack that matches Firebase → keep Cache Storage tiles.
  if (existingPack && isLocalPackCurrent(existingPack, remote)) {
    return existingPack;
  }

  const bbox = tupleToBbox(remote.bbox);
  const tiles = tilesForBbox(bbox, remote.zoomMin, remote.zoomMax);
  const cache = await caches.open(getOfflineCacheName(cragId));
  const newUrls = new Set(
    tiles.map((t) => getCragOpenTopoTileUrl(cragId, t.z, t.x, t.y)),
  );

  const packUrl = getCragOpenTopoPackUrl(cragId);
  const archiveTotal = remote.archiveBytes > 0 ? remote.archiveBytes : 1;

  onProgress?.({ done: 0, total: archiveTotal, label: 'Downloading map tiles…' });

  const response = await fetch(packUrl, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(
      `OpenTopo tile sync for ${cragId} failed: pack download HTTP ${response.status}`,
    );
  }

  const zipBytes = await readResponseBytes(response, (received, total) => {
    const denom = total && total > 0 ? total : archiveTotal;
    onProgress?.({
      done: Math.min(received, denom),
      total: denom,
      label: 'Downloading map tiles…',
    });
  });

  onProgress?.({ done: 0, total: remote.tileCount || 1, label: 'Unpacking map tiles…' });

  let entries: Record<string, Uint8Array>;
  try {
    entries = await unzipAsync(zipBytes);
  } catch (err) {
    throw new Error(
      `OpenTopo tile sync for ${cragId} failed: could not unzip pack (${
        err instanceof Error ? err.message : err
      })`,
    );
  }

  const entryPaths = Object.keys(entries).filter(
    (path) => !path.endsWith('/') && parseTileEntryPath(path),
  );
  const unpackTotal = entryPaths.length || 1;
  let cachedCount = 0;
  let failedCount = 0;

  for (let i = 0; i < entryPaths.length; i++) {
    const path = entryPaths[i];
    const coords = parseTileEntryPath(path);
    if (!coords) continue;
    const url = getCragOpenTopoTileUrl(cragId, coords.z, coords.x, coords.y);
    onProgress?.({
      done: i,
      total: unpackTotal,
      label: `${coords.z}/${coords.x}/${coords.y}.png`,
    });
      try {
      const png = entries[path];
      await cache.put(
        url,
        new Response(Uint8Array.from(png), {
          headers: { 'Content-Type': 'image/png' },
        }),
      );
      cachedCount++;
    } catch (err) {
      failedCount++;
      console.warn(
        `Failed to cache OpenTopo tile ${url}:`,
        err instanceof Error ? err.message : err,
      );
    }
    onProgress?.({
      done: i + 1,
      total: unpackTotal,
      label: `${coords.z}/${coords.x}/${coords.y}.png`,
    });
  }

  if (cachedCount === 0 && remote.tileCount > 0) {
    throw new Error(
      `OpenTopo tile sync for ${cragId} failed: no tiles could be unpacked from pack`,
    );
  }

  // Preserve Firebase pack identity for the next compare.
  // Incomplete unpacks keep a mismatched `tileCount` so the next sync retries.
  const pack: OpenTopoTilePackInfo = {
    ...remote,
    tileCount: cachedCount,
  };

  // Only prune after a complete pack so a failed refresh cannot wipe tiles
  // that still match the previous bbox.
  if (cachedCount === remote.tileCount) {
    const cachedRequests = await cache.keys();
    for (const request of cachedRequests) {
      if (!isOpenTopoTileUrl(request.url, cragId)) continue;
      // Keep pack.zip out of tile pruning concerns; only prune tile PNGs.
      if (request.url.includes('pack.zip')) continue;
      if (!newUrls.has(request.url)) {
        await cache.delete(request);
      }
    }
  } else {
    console.warn(
      `OpenTopo tile sync for ${cragId} incomplete: cached ${cachedCount}/${remote.tileCount} tiles${
        failedCount ? ` (${failedCount} write failures)` : ''
      }; will retry on next sync`,
    );
  }

  return pack;
}

/** Cached OpenTopo pack from the offline manifest, if this crag was synced with tiles. */
export async function getCachedOpenTopoTilePack(
  cragId: string,
): Promise<OpenTopoTilePackInfo | undefined> {
  const manifest = await getOfflineManifest(cragId);
  const pack = manifest?.opentopoTilePack;
  if (!pack || pack.tileCount <= 0) return undefined;
  return pack;
}

/**
 * Leaflet tile layer that loads OpenTopo PNGs from synthetic Firebase Storage URLs
 * (served from Cache Storage by the service worker when offline).
 */
export function createCachedOpenTopoLayer(
  cragId: string,
  pack: OpenTopoTilePackInfo,
): L.TileLayer {
  const OfflineOpenTopoLayer = L.TileLayer.extend({
    getTileUrl(coords: L.Coords) {
      return getCragOpenTopoTileUrl(cragId, coords.z, coords.x, coords.y);
    },
  }) as unknown as new (url: string, options?: L.TileLayerOptions) => L.TileLayer;

  return new OfflineOpenTopoLayer('', {
    attribution:
      'Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, SRTM | Map style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a> (<a href="https://creativecommons.org/licenses/by-sa/3.0/">CC-BY-SA</a>)',
    minZoom: pack.zoomMin,
    maxZoom: pack.zoomMax,
    maxNativeZoom: pack.zoomMax,
  });
}
