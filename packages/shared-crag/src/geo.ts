import type { CragData, LatLng } from './types';

function collectCragCoordinates(cragData: CragData): LatLng[] {
  const coords: LatLng[] = [];
  for (const s of cragData.sectors) {
    if (s.geo) coords.push(s.geo);
  }
  for (const m of cragData.markers ?? []) {
    coords.push(m.geo);
  }
  for (const t of cragData.trails ?? []) {
    coords.push(...t.points);
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

export function computeCragBounds(cragData: CragData): BBox | null {
  const coords = collectCragCoordinates(cragData);
  if (coords.length === 0) return null;

  let south = Infinity;
  let west = Infinity;
  let north = -Infinity;
  let east = -Infinity;
  for (const { lat, lon } of coords) {
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
