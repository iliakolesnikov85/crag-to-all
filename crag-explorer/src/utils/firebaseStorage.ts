import { cragStoragePath } from '@crag-to-all/shared-crag';

/**
 * Firebase Storage URL utilities for images, PDFs, and map tiles.
 *
 * Crag documents come from crag-api. File URLs use production Storage unless
 * `npm run dev-local` sets VITE_DEV_LOCAL=true (localhost:9199).
 * `VITE_FIREBASE_STORAGE_BUCKET_v2` selects the bucket; unset uses `crag-to-all`.
 */

const FIREBASE_BUCKET = import.meta.env.VITE_FIREBASE_STORAGE_BUCKET_v2?.trim() || 'crag-to-all';

const DEV_LOCAL = import.meta.env.VITE_DEV_LOCAL === 'true';

const FIREBASE_BASE_URL = DEV_LOCAL
  ? `http://localhost:9199/v0/b/${FIREBASE_BUCKET}/o`
  : `https://firebasestorage.googleapis.com/v0/b/${FIREBASE_BUCKET}/o`;

if (DEV_LOCAL) {
  console.log('Using local Firebase Storage at http://localhost:9199');
} else {
  console.log('Using Firebase Storage production');
}

/**
 * Construct a Firebase Storage URL for a given file path
 * @param filePath - The file path in Firebase Storage (e.g., 'crags/roshka/roshka.json')
 * @returns The public Firebase Storage URL
 */
export function getFirebaseStorageUrl(filePath: string): string {
  const encodedPath = encodeURIComponent(filePath);
  return `${FIREBASE_BASE_URL}/${encodedPath}?alt=media`;
}

/**
 * Get the URL for a crag guide PDF
 * @param cragId - The crag identifier
 * @returns The Firebase Storage URL for the guide PDF
 */
export function getCragGuideUrl(cragId: string): string {
  return getFirebaseStorageUrl(cragStoragePath(cragId, `${cragId}-guide.pdf`));
}

/**
 * Get the URL for a crag image
 * @param cragId - The crag identifier
 * @param imageFile - The image filename
 * @returns The Firebase Storage URL for the image
 */
export function getCragImageUrl(cragId: string, imageFile: string): string {
  return getFirebaseStorageUrl(cragStoragePath(cragId, 'topo-images', imageFile));
}

/**
 * Get the URL for the OpenTopo tile ZIP pack in Firebase Storage.
 * Path: `crags/{cragId}/tiles/opentopo/pack.zip`
 */
export function getCragOpenTopoPackUrl(cragId: string): string {
  return getFirebaseStorageUrl(cragStoragePath(cragId, 'tiles', 'opentopo', 'pack.zip'));
}

/**
 * Synthetic Firebase Storage URL used as the Cache Storage key for a tile PNG.
 * Individual PNGs are not uploaded; the offline sync unpacks pack.zip into these keys.
 */
export function getCragOpenTopoTileUrl(
  cragId: string,
  z: number,
  x: number,
  y: number,
): string {
  return getFirebaseStorageUrl(
    cragStoragePath(cragId, 'tiles', 'opentopo', String(z), String(x), `${y}.png`),
  );
}
