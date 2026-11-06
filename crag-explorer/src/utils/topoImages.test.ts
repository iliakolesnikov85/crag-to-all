import { describe, expect, it } from 'vitest';
import type { Image } from '../types';
import { moveTopoImage, removeTopoImage } from './topoImages';

const images: Image[] = [
  { imageFile: 'a.jpg' },
  { imageFile: 'b.jpg' },
  { imageFile: 'a.jpg' },
];

describe('topoImages', () => {
  it('moves an image up or down and refuses the ends', () => {
    expect(moveTopoImage(images, 1, -1)?.map((image) => image.imageFile)).toEqual([
      'b.jpg',
      'a.jpg',
      'a.jpg',
    ]);
    expect(moveTopoImage(images, 1, 1)?.map((image) => image.imageFile)).toEqual([
      'a.jpg',
      'a.jpg',
      'b.jpg',
    ]);
    expect(moveTopoImage(images, 0, -1)).toBeNull();
    expect(moveTopoImage(images, 2, 1)).toBeNull();
  });

  it('removes one image by index and keeps the others', () => {
    const removed = removeTopoImage(images, 1);
    expect(removed?.map((image) => image.imageFile)).toEqual(['a.jpg', 'a.jpg']);
    expect(removed?.[0]).toBe(images[0]);
    expect(removeTopoImage(images, -1)).toBeNull();
    expect(removeTopoImage(images, 3)).toBeNull();
  });
});
