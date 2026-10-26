/**
 * Firebase Storage URL utilities for images, PDFs, GPX, and map tiles.
 *
 * Crag documents come from crag-api. File URLs use production Storage unless
 * `npm run dev-local` sets VITE_DEV_LOCAL=true (localhost:9199).
 */

const FIREBASE_BUCKET = 'crag-to-all.firebasestorage.app';

const DEV_LOCAL = import.meta.env.VITE_DEV_LOCAL === 'true';

const FIREBASE_BASE_URL = DEV_LOCAL
  ? `http://localhost:9199/v0/b/${FIREBASE_BUCKET}/o`
  : `https://firebasestorage.googleapis.com/v0/b/${FIREBASE_BUCKET}/o`;

if (DEV_LOCAL) {
  console.log('Using Firebase Storage emulator at http://localhost:9199');
} else {
  console.log('Using Firebase Storage production');
}

/**
 * Construct a Firebase Storage URL for a given file path
 * @param filePath - The file path in Firebase Storage (e.g., 'roshka/roshka.json')
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
  return getFirebaseStorageUrl(`${cragId}/${cragId}-guide.pdf`);
}

/**
 * Get the URL for a crag sectors GPX file
 * @param cragId - The crag identifier
 * @returns The Firebase Storage URL for the sectors GPX
 */
export function getCragSectorsGpxUrl(cragId: string): string {
  return getFirebaseStorageUrl(`${cragId}/${cragId}-sectors.gpx`);
}

/**
 * Get the URL for a crag image
 * @param cragId - The crag identifier
 * @param imageFile - The image filename
 * @returns The Firebase Storage URL for the image
 */
export function getCragImageUrl(cragId: string, imageFile: string): string {
  return getFirebaseStorageUrl(`${cragId}/images/${imageFile}`);
}

/**
 * Get the URL for the OpenTopo tile ZIP pack in Firebase Storage.
 * Path: `{cragId}/tiles/opentopo/pack.zip`
 */
export function getCragOpenTopoPackUrl(cragId: string): string {
  return getFirebaseStorageUrl(`${cragId}/tiles/opentopo/pack.zip`);
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
    `${cragId}/tiles/opentopo/${z}/${x}/${y}.png`,
  );
}
