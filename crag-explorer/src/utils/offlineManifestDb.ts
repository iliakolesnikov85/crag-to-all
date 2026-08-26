import type { Crag, OpenTopoTilePackInfo } from '../types';

const DB_NAME = 'crag-explorer-offline';
const DB_VERSION = 2;
const STORE = 'manifests';
const META_STORE = 'meta';
const INDEX_META_KEY = 'crag-index';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'cragId' });
      }
      if (!db.objectStoreNames.contains(META_STORE)) {
        db.createObjectStore(META_STORE);
      }
    };
  });
}

export interface OfflineCragManifest {
  cragId: string;
  cragName: string;
  imageFiles: string[];
  downloadedAt: number;
  lastSyncedAt: number;
  /** SHA-256 of stable-stringified crag JSON. */
  jsonChecksum: string;
  /** Cached OpenTopo raster tile pack (from Firebase), absent if never fetched. */
  opentopoTilePack?: OpenTopoTilePackInfo;
}

export async function putOfflineCragIndex(crags: Crag[]): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(META_STORE, 'readwrite');
    const request = tx.objectStore(META_STORE).put(crags, INDEX_META_KEY);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
    tx.oncomplete = () => db.close();
  });
}

export async function getOfflineCragIndex(): Promise<Crag[] | undefined> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(META_STORE, 'readonly');
    const request = tx.objectStore(META_STORE).get(INDEX_META_KEY);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result as Crag[] | undefined);
    tx.oncomplete = () => db.close();
  });
}

export async function getAllOfflineManifests(): Promise<OfflineCragManifest[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const store = tx.objectStore(STORE);
    const request = store.getAll();
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result as OfflineCragManifest[]);
    tx.oncomplete = () => db.close();
  });
}

export async function getOfflineManifest(
  cragId: string,
): Promise<OfflineCragManifest | undefined> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const request = tx.objectStore(STORE).get(cragId);
    request.onerror = () => reject(request.error);
    request.onsuccess = () =>
      resolve(request.result as OfflineCragManifest | undefined);
    tx.oncomplete = () => db.close();
  });
}

export async function putOfflineManifest(
  manifest: OfflineCragManifest,
): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const request = tx.objectStore(STORE).put(manifest);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
    tx.oncomplete = () => db.close();
  });
}

export async function deleteOfflineManifest(cragId: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const request = tx.objectStore(STORE).delete(cragId);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
    tx.oncomplete = () => db.close();
  });
}
