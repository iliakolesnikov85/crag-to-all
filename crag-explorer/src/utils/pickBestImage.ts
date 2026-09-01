import { Image, Sector } from '../types';

// Pick the sector image that is referenced by the most routes.
// Falls back to the first image when none of them have explicit route refs.
export function pickBestImage(sector: Sector): { image: Image } | null {
  if (!sector.images || sector.images.length === 0) return null;
  let bestImage = sector.images[0];
  let bestCount = -1;
  for (const image of sector.images) {
    const count = sector.routes.reduce(
      (acc, route) =>
        acc + (route.images.some((img) => img.imageFile === image.imageFile) ? 1 : 0),
      0,
    );
    if (count > bestCount) {
      bestCount = count;
      bestImage = image;
    }
  }
  return { image: bestImage };
}
