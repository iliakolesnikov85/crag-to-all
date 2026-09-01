import { describe, expect, it } from 'vitest';
import type { Sector } from '../types';
import { sampleCragData } from '../test/fixtures/cragData';
import { pickBestImage } from './pickBestImage';

function sector(overrides: Partial<Sector>): Sector {
  return {
    name: 'Wall',
    geo: null,
    routes: [],
    images: [],
    ...overrides,
  };
}

describe('pickBestImage', () => {
  it('returns null when the sector has no images', () => {
    expect(pickBestImage(sector({}))).toBeNull();
    expect(pickBestImage(sampleCragData.sectors[1])).toBeNull();
  });

  it('falls back to the first image when none are referenced by routes', () => {
    const result = pickBestImage(
      sector({
        images: [{ imageFile: 'a.jpg' }, { imageFile: 'b.jpg' }],
        routes: [
          {
            name: 'r',
            grade: '6A',
            sectorName: 'Wall',
            description: '',
            tags: [],
            images: [],
          },
        ],
      }),
    );
    expect(result?.image.imageFile).toBe('a.jpg');
  });

  it('picks the image referenced by the most routes', () => {
    const result = pickBestImage(
      sector({
        images: [{ imageFile: 'a.jpg' }, { imageFile: 'b.jpg' }],
        routes: [
          {
            name: 'one',
            grade: '6A',
            sectorName: 'Wall',
            description: '',
            tags: [],
            images: [{ imageFile: 'b.jpg', routeIndex: 0 }],
          },
          {
            name: 'two',
            grade: '6B',
            sectorName: 'Wall',
            description: '',
            tags: [],
            images: [{ imageFile: 'b.jpg', routeIndex: 0 }],
          },
          {
            name: 'three',
            grade: '6C',
            sectorName: 'Wall',
            description: '',
            tags: [],
            images: [{ imageFile: 'a.jpg', routeIndex: 0 }],
          },
        ],
      }),
    );
    expect(result?.image.imageFile).toBe('b.jpg');
  });

  it('uses the sample fixture wall image', () => {
    expect(pickBestImage(sampleCragData.sectors[0])?.image.imageFile).toBe(
      'wall.jpg',
    );
  });
});
