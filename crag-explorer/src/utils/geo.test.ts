import { describe, expect, it } from 'vitest';
import {
  CRAG_DATA_PROTOCOL,
  computeCragBounds,
  tilesForBbox,
  type CragData,
} from '@crag-to-all/shared-crag';

const emptyCrag = (): CragData => ({
  protocolVersion: CRAG_DATA_PROTOCOL,
  name: 'Empty',
  sectors: [],
  description: [],
});

describe('computeCragBounds', () => {
  it('returns null when there are no coordinates', () => {
    expect(computeCragBounds(emptyCrag())).toBeNull();
    expect(
      computeCragBounds({
        ...emptyCrag(),
        sectors: [{ name: 's', geo: null, routes: [], images: [] }],
      }),
    ).toBeNull();
  });

  it('spans sector geo, markers, and trail points', () => {
    const bounds = computeCragBounds({
      protocolVersion: CRAG_DATA_PROTOCOL,
      name: 'x',
      description: [],
      sectors: [{ name: 's', geo: { lat: 10, lon: 20 }, routes: [], images: [] }],
      markers: [
        { type: 'parking_space', info: '', geo: { lat: 11, lon: 21 } },
      ],
      trails: [
        {
          name: 't',
          color: '#f00',
          points: [
            { lat: 9, lon: 19 },
            { lat: 12, lon: 22 },
          ],
        },
      ],
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
