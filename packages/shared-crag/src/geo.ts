import type { CragData } from './types';

function collectCragCoordinates(cragData: CragData): [number, number][] {
  const coords: [number, number][] = [];
  for (const s of cragData.sectors) {
    const g = s.geo ? parseGeo(s.geo) : null;
    if (g && isLatLngValid(g[0], g[1])) coords.push(g);
  }
  for (const m of cragData.markers ?? []) {
    const g = parseMarkerLatLng(m);
    if (g) coords.push(g);
  }
  for (const t of cragData.trails ?? []) {
    for (const p of parseTrailLatLngs(t.points)) {
      coords.push(p);
    }
  }
  return coords;
}

function lonToTileX(lon: number, z: number): number {
  return Math.floor(((lon + 180) / 360) * Math.pow(2, z));
}

function latToTileY(lat: number, z: number): number {
  const latRad = (lat * Math.PI) / 180;
  return Math.floor(
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) *
      Math.pow(2, z),
  );
}

export interface BBox {
  south: number;
  west: number;
  north: number;
  east: number;
}

export interface TileCoord {
  z: number;
  x: number;
  y: number;
}

export function isLatLngValid(lat: number, lon: number): boolean {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lon) &&
    lat >= -90 &&
    lat <= 90 &&
    lon >= -180 &&
    lon <= 180
  );
}

export function parseGeo(geo: string | null | undefined): [number, number] | null {
  if (!geo) return null;
  const match = geo.match(/([0-9.\-]+),\s*([0-9.\-]+)/);
  if (!match) return null;
  return [parseFloat(match[1]), parseFloat(match[2])];
}

export function parseMarkerLatLng(
  m: { latitude: string; longitude: string },
): [number, number] | null {
  const lat = parseFloat(m.latitude);
  const lon = parseFloat(m.longitude);
  if (!isLatLngValid(lat, lon)) return null;
  return [lat, lon];
}

export function parseTrailLatLngs(points: string): [number, number][] {
  const out: [number, number][] = [];
  for (const segment of points.split(';')) {
    const trimmed = segment.trim();
    if (!trimmed) continue;
    const parts = trimmed.split(',').map((p) => p.trim());
    if (parts.length < 2) continue;
    const lat = parseFloat(parts[0]);
    const lon = parseFloat(parts[1]);
    if (isLatLngValid(lat, lon)) out.push([lat, lon]);
  }
  return out;
}

export function computeCragBounds(cragData: CragData): BBox | null {
  const coords = collectCragCoordinates(cragData);
  if (coords.length === 0) return null;

  let south = Infinity;
  let west = Infinity;
  let north = -Infinity;
  let east = -Infinity;
  for (const [lat, lon] of coords) {
    if (lat < south) south = lat;
    if (lat > north) north = lat;
    if (lon < west) west = lon;
    if (lon > east) east = lon;
  }
  return { south, west, north, east };
}

/** All XYZ tiles covering a bbox across the given zoom range (inclusive). */
export function tilesForBbox(
  bbox: BBox,
  zoomMin: number,
  zoomMax: number,
): TileCoord[] {
  const tiles: TileCoord[] = [];
  for (let z = zoomMin; z <= zoomMax; z++) {
    const xMin = lonToTileX(bbox.west, z);
    const xMax = lonToTileX(bbox.east, z);
    const yMin = latToTileY(bbox.north, z);
    const yMax = latToTileY(bbox.south, z);
    for (let x = xMin; x <= xMax; x++) {
      for (let y = yMin; y <= yMax; y++) {
        tiles.push({ z, x, y });
      }
    }
  }
  return tiles;
}
