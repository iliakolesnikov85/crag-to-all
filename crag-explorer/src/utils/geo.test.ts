import { describe, expect, it } from 'vitest';
import {
  computeCragBounds,
  isLatLngValid,
  parseGeo,
  tilesForBbox,
  type CragData,
} from '@crag-to-all/shared-crag';

const emptyCrag = (): CragData => ({
  name: 'Empty',
  sectors: [],
  description: [],
});

describe('isLatLngValid', () => {
  it('accepts finite coordinates in range', () => {
    expect(isLatLngValid(0, 0)).toBe(true);
    expect(isLatLngValid(90, 180)).toBe(true);
    expect(isLatLngValid(-90, -180)).toBe(true);
  });

  it('rejects out-of-range, NaN, and infinite values', () => {
    expect(isLatLngValid(90.1, 0)).toBe(false);
    expect(isLatLngValid(0, 180.1)).toBe(false);
    expect(isLatLngValid(Number.NaN, 0)).toBe(false);
    expect(isLatLngValid(0, Number.POSITIVE_INFINITY)).toBe(false);
  });
});

describe('parseGeo', () => {
  it('parses lat,lon pairs including negatives', () => {
    expect(parseGeo('42.1234, 44.5678')).toEqual([42.1234, 44.5678]);
    expect(parseGeo('-41.5,-44.2')).toEqual([-41.5, -44.2]);
  });

  it('returns null for missing or unparseable values', () => {
    expect(parseGeo(null)).toBeNull();
    expect(parseGeo(undefined)).toBeNull();
    expect(parseGeo('')).toBeNull();
    expect(parseGeo('not-a-coord')).toBeNull();
  });
});

describe('computeCragBounds', () => {
  it('returns null when there are no valid coordinates', () => {
    expect(computeCragBounds(emptyCrag())).toBeNull();
    expect(
      computeCragBounds({
        ...emptyCrag(),
        sectors: [{ name: 's', geo: 'not-a-coord', routes: [], images: [] }],
      }),
    ).toBeNull();
  });

  it('spans sector geo, markers, and trail points', () => {
    const bounds = computeCragBounds({
      name: 'x',
      description: [],
      sectors: [{ name: 's', geo: '10, 20', routes: [], images: [] }],
      markers: [
        { type: 'parking', info: '', latitude: '11', longitude: '21' },
        { type: 'bad', info: '', latitude: '999', longitude: '0' },
      ],
      trails: [{ name: 't', color: '#f00', points: '9,19; 12,22; junk' }],
    });
    expect(bounds).toEqual({ south: 9, west: 19, north: 12, east: 22 });
  });
});

describe('tilesForBbox', () => {
  it('returns the world tile at zoom 0 for a point at the origin', () => {
    expect(
      tilesForBbox({ south: 0, west: 0, north: 0, east: 0 }, 0, 0),
    ).toEqual([{ z: 0, x: 0, y: 0 }]);
  });

  it('returns the expected tile at zoom 1 for a point at the origin', () => {
    expect(
      tilesForBbox({ south: 0, west: 0, north: 0, east: 0 }, 1, 1),
    ).toEqual([{ z: 1, x: 1, y: 1 }]);
  });

  it('returns no tiles when zoomMin is above zoomMax', () => {
    expect(
      tilesForBbox({ south: 0, west: 0, north: 0, east: 0 }, 2, 1),
    ).toEqual([]);
  });
});
