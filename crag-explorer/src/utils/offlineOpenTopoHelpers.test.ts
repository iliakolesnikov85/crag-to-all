import { describe, expect, it } from 'vitest';
import type { OpenTopoTilePackInfo } from '../types';
import { getCragOpenTopoTileUrl } from './firebaseStorage';
import {
  isOpenTopoTilePacksEquals,
  isOpenTopoTileUrl,
  parseTileEntryPath,
} from './offlineOpenTopoHelpers';

function pack(overrides: Partial<OpenTopoTilePackInfo> = {}): OpenTopoTilePackInfo {
  return {
    bbox: [41, 44, 42, 45],
    zoomMin: 10,
    zoomMax: 16,
    packVersion: 3,
    fetchedAt: 1_700_000_000_000,
    tileCount: 12,
    totalBytes: 4_000,
    archiveBytes: 1_200,
    ...overrides,
  };
}

describe('parseTileEntryPath', () => {
  it('parses z/x/y.png with optional folders and leading slashes', () => {
    expect(parseTileEntryPath('10/512/384.png')).toEqual({
      z: 10,
      x: 512,
      y: 384,
    });
    expect(parseTileEntryPath('/tiles/10/512/384.PNG')).toEqual({
      z: 10,
      x: 512,
      y: 384,
    });
  });

  it('returns null for non-tile paths', () => {
    expect(parseTileEntryPath('pack.zip')).toBeNull();
    expect(parseTileEntryPath('10/512/384.jpg')).toBeNull();
    expect(parseTileEntryPath('10/512/')).toBeNull();
  });
});

describe('isOpenTopoTilePacksEquals', () => {
  it('requires every metadata field to match, including fetchedAt', () => {
    const remote = pack();
    expect(isOpenTopoTilePacksEquals(remote, remote)).toBe(true);
    expect(isOpenTopoTilePacksEquals(pack({ fetchedAt: 1 }), remote)).toBe(false);
    expect(isOpenTopoTilePacksEquals(pack({ bbox: [0, 0, 1, 1] }), remote)).toBe(false);
    expect(isOpenTopoTilePacksEquals(pack({ tileCount: 11 }), remote)).toBe(false);
    expect(isOpenTopoTilePacksEquals(pack({ archiveBytes: 99 }), remote)).toBe(false);
  });
});

describe('isOpenTopoTileUrl', () => {
  it('matches encoded Firebase keys and plain tile paths for that crag', () => {
    expect(isOpenTopoTileUrl(getCragOpenTopoTileUrl('roshka', 12, 1, 2), 'roshka')).toBe(
      true,
    );
    expect(
      isOpenTopoTileUrl('https://example.com/roshka/tiles/opentopo/12/1/2.png', 'roshka'),
    ).toBe(true);
    expect(isOpenTopoTileUrl(getCragOpenTopoTileUrl('other', 12, 1, 2), 'roshka')).toBe(
      false,
    );
  });
});
