/**
 * Firebase Storage URL utilities
 *
 * Optional local emulator: start Storage on port 9199, then
 * `npm run dev:use-emulator`.
 *
 * VITE_USE_FIREBASE_EMULATOR=true  → http://localhost:9199
 * VITE_USE_FIREBASE_EMULATOR unset → production Firebase Storage
 */

const FIREBASE_BUCKET = 'crag-to-all.firebasestorage.app';

// Check if we should use the emulator
const USE_EMULATOR = (import.meta as any).env?.VITE_USE_FIREBASE_EMULATOR === 'true';

// Base URL for Firebase Storage (production or emulator)
const FIREBASE_BASE_URL = USE_EMULATOR 
  ? `http://localhost:9199/v0/b/${FIREBASE_BUCKET}/o`
  : `https://firebasestorage.googleapis.com/v0/b/${FIREBASE_BUCKET}/o`;

// Log which mode we're using
if (USE_EMULATOR) {
  console.log('🔥 Using Firebase Storage Emulator at http://localhost:9199');
} else {
  console.log('☁️ Using Firebase Storage Production');
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
 * Get the URL for crag data JSON file
 * @param cragId - The crag identifier
 * @returns The Firebase Storage URL for the crag data
 */
export function getCragDataUrl(cragId: string): string {
  return getFirebaseStorageUrl(`${cragId}/${cragId}.json`);
}

/**
 * Get the URL for the crag index JSON file
 * @returns The Firebase Storage URL for the index file
 */
export function getCragIndexUrl(): string {
  return getFirebaseStorageUrl('index.json');
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
