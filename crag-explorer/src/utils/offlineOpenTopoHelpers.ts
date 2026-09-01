import type { OpenTopoTilePackInfo } from '../types';

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
export function isOpenTopoTilePacksEquals(
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

export function isOpenTopoTileUrl(url: string, cragId: string): boolean {
  const marker = encodeURIComponent(`${cragId}/tiles/opentopo/`);
  return url.includes(marker) || url.includes(`${cragId}/tiles/opentopo/`);
}

/** Parse `z/x/y.png` (or with leading folders) into tile coords. */
export function parseTileEntryPath(
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
