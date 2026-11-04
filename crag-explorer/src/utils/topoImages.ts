import type { Image } from '../types';

function moveTopoImage(
  images: readonly Image[],
  index: number,
  direction: -1 | 1,
): Image[] | null {
  const target = index + direction;
  if (index < 0 || index >= images.length || target < 0 || target >= images.length) return null;
  const next = images.slice();
  const [image] = next.splice(index, 1);
  next.splice(target, 0, image);
  return next;
}

function removeTopoImage(images: readonly Image[], index: number): Image[] | null {
  if (index < 0 || index >= images.length) return null;
  return images.filter((_, imageIndex) => imageIndex !== index);
}

export { moveTopoImage, removeTopoImage };
