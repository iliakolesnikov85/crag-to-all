import { existsSync, readFileSync } from 'fs';
import { isAbsolute, resolve } from 'path';
import { zipSync } from 'fflate';
import { App, cert, getApps, initializeApp, type ServiceAccount } from 'firebase-admin/app';
import { getStorage } from 'firebase-admin/storage';
import type { Bucket, File } from '@google-cloud/storage';

function assertServiceAccountJson(parsed: unknown): asserts parsed is {
  type: 'service_account';
  project_id: string;
  private_key: string;
  client_email: string;
} {
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Service account JSON must be an object.');
  }
  const o = parsed as Record<string, unknown>;
  if (o.type !== 'service_account') {
    throw new Error('Service account JSON must have type "service_account".');
  }
  for (const key of ['project_id', 'private_key', 'client_email'] as const) {
    if (typeof o[key] !== 'string' || !(o[key] as string).trim()) {
      throw new Error(`Service account JSON is missing or invalid field: ${key}`);
    }
  }
}

/** Relative paths in .env are resolved from cwd first, then from this package and typical app folders. */
function resolveServiceAccountKeyPath(keyPath: string): string {
  if (isAbsolute(keyPath)) {
    return keyPath;
  }
  const cwd = process.cwd();
  const candidates = [
    resolve(cwd, keyPath),
    resolve(cwd, '..', '..', 'crag-extract', keyPath),
    resolve(cwd, 'crag-extract', keyPath)
  ];
  for (const p of candidates) {
    if (existsSync(p)) {
      return p;
    }
  }
  return resolve(cwd, keyPath);
}

function parseServiceAccountFromEnv(): ServiceAccount {
  const rawFromEnv = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  const keyPath = process.env.FIREBASE_SERVICE_ACCOUNT_KEY_PATH;

  if (!rawFromEnv && !keyPath) {
    throw new Error(
      'Missing Firebase service account credentials. Set FIREBASE_SERVICE_ACCOUNT_KEY or FIREBASE_SERVICE_ACCOUNT_KEY_PATH.'
    );
  }

  let raw: string | undefined;
  let source: 'FIREBASE_SERVICE_ACCOUNT_KEY' | 'FIREBASE_SERVICE_ACCOUNT_KEY_PATH';

  if (rawFromEnv) {
    raw = rawFromEnv;
    source = 'FIREBASE_SERVICE_ACCOUNT_KEY';
  } else if (keyPath) {
    const resolvedPath = resolveServiceAccountKeyPath(keyPath);
    try {
      raw = readFileSync(resolvedPath, 'utf-8');
    } catch (e) {
      throw new Error(
        `Could not read FIREBASE_SERVICE_ACCOUNT_KEY_PATH (${resolvedPath}): ${e instanceof Error ? e.message : String(e)}`
      );
    }
    source = 'FIREBASE_SERVICE_ACCOUNT_KEY_PATH';
  } else {
    throw new Error('Firebase service account credentials are empty.');
  }

  if (!raw) {
    throw new Error('Firebase service account credentials are empty.');
  }

  let normalized = raw.trim();
  if (normalized.charCodeAt(0) === 0xfeff) {
    normalized = normalized.slice(1);
  }
  if (
    (normalized.startsWith('"') && normalized.endsWith('"')) ||
    (normalized.startsWith("'") && normalized.endsWith("'"))
  ) {
    normalized = normalized.slice(1, -1);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(normalized);
  } catch {
    throw new Error(
      `${source} is not valid JSON. For .env, use a single-line JSON string or set FIREBASE_SERVICE_ACCOUNT_KEY_PATH to a JSON file.`
    );
  }

  assertServiceAccountJson(parsed);

  const privateKey = parsed.private_key.replace(/\\n/g, '\n');

  return {
    projectId: parsed.project_id,
    privateKey,
    clientEmail: parsed.client_email
  };
}

function getAdminApp(useEmulator: boolean): App {
  const existingApp = getApps()[0];
  if (existingApp) {
    return existingApp;
  }

  const defaultProjectId = process.env.FIREBASE_PROJECT_ID || 'crag-to-all';
  const defaultBucket = process.env.FIREBASE_STORAGE_BUCKET || 'crag-to-all.firebasestorage.app';

  if (useEmulator) {
    process.env.FIREBASE_STORAGE_EMULATOR_HOST = process.env.FIREBASE_STORAGE_EMULATOR_HOST || '127.0.0.1:9199';
    return initializeApp({ projectId: defaultProjectId, storageBucket: defaultBucket });
  }

  const serviceAccount = parseServiceAccountFromEnv();
  const projectId = process.env.FIREBASE_PROJECT_ID?.trim() || serviceAccount.projectId;
  const storageBucket = process.env.FIREBASE_STORAGE_BUCKET?.trim() || 'crag-to-all.firebasestorage.app';
  return initializeApp({
    credential: cert(serviceAccount),
    projectId,
    storageBucket
  });
}

let initialized = false;
let bucket: Bucket | null = null;
let currentBucketName: string | null = null;

export function initializeFirebase(useEmulator: boolean = false) {
  if (!initialized) {
    const app = getAdminApp(useEmulator);
    const storageBucket = process.env.FIREBASE_STORAGE_BUCKET || 'crag-to-all.firebasestorage.app';
    bucket = getStorage(app).bucket(storageBucket);
    currentBucketName = storageBucket;
    initialized = true;
    console.log(`Firebase Admin initialized (${useEmulator ? 'emulator' : 'production'} mode)`);
  }
}

function getInitializedBucket() {
  if (!bucket) {
    throw new Error('Firebase not initialized. Call initializeFirebase() first.');
  }
  return bucket;
}

/** GCS object metadata; safe for content-addressed / hashed image filenames. */
export const IMAGE_OBJECT_CACHE_CONTROL = 'public, max-age=31536000, immutable';

function guessImageContentType(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'png':
      return 'image/png';
    case 'gif':
      return 'image/gif';
    case 'webp':
      return 'image/webp';
    case 'svg':
      return 'image/svg+xml';
    case 'avif':
      return 'image/avif';
    default:
      return 'image/jpeg';
  }
}

/** Local calendar date as `yyyy-MM-dd` for history folder names. */
export function formatHistoryDate(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Live crag file `{cragId}/{fileName}` → `{cragId}/history/yyyy-MM-dd/{fileName}.zip`.
 * `filePath` must be a file in the crag root (one slash).
 */
export function toHistoryStoragePath(filePath: string, date: Date = new Date()): string {
  const slash = filePath.indexOf('/');
  if (slash <= 0 || filePath.indexOf('/', slash + 1) !== -1 || slash === filePath.length - 1) {
    throw new Error(`Expected a crag-root storage path like "{cragId}/{fileName}", got: ${filePath}`);
  }
  const cragId = filePath.slice(0, slash);
  const fileName = filePath.slice(slash + 1);
  return `${cragId}/history/${formatHistoryDate(date)}/${fileName}.zip`;
}

function zipNamedFile(fileName: string, data: Buffer): Buffer {
  const bytes = new Uint8Array(data.byteLength);
  bytes.set(data);
  return Buffer.from(zipSync({ [fileName]: bytes }));
}

export class FirebaseStorageService {
  async uploadFile(
    filePath: string,
    data: Buffer | string,
    contentType?: string,
    customMetadata?: Record<string, string>
  ): Promise<void> {
    const uploadData = typeof data === 'string' ? Buffer.from(data, 'utf-8') : data;
    const targetBucket = getInitializedBucket();
    await targetBucket.file(filePath).save(uploadData, {
      resumable: false,
      metadata: contentType || customMetadata
        ? {
            ...(contentType ? { contentType } : {}),
            ...(customMetadata ? { metadata: customMetadata } : {})
          }
        : undefined
    });
  }

  /** Uploads to the live crag-root path and a zipped copy under `{cragId}/history/yyyy-MM-dd/`. */
  async uploadFileWithHistory(
    filePath: string,
    data: Buffer | string,
    contentType?: string,
    customMetadata?: Record<string, string>
  ): Promise<void> {
    const uploadData = typeof data === 'string' ? Buffer.from(data, 'utf-8') : data;
    await this.uploadFile(filePath, uploadData, contentType, customMetadata);
    const fileName = filePath.slice(filePath.lastIndexOf('/') + 1);
    await this.uploadFile(
      toHistoryStoragePath(filePath),
      zipNamedFile(fileName, uploadData),
      'application/zip',
      customMetadata
    );
  }

  async uploadJson(filePath: string, data: unknown): Promise<void> {
    const jsonString = JSON.stringify(data, null, 2);
    await this.uploadFile(filePath, jsonString, 'application/json');
  }

  /** Uploads JSON to the live crag-root path and a zipped copy under `{cragId}/history/yyyy-MM-dd/`. */
  async uploadJsonWithHistory(filePath: string, data: unknown): Promise<void> {
    const jsonString = JSON.stringify(data, null, 2);
    await this.uploadFileWithHistory(filePath, jsonString, 'application/json');
  }

  async uploadText(filePath: string, text: string, contentType: string = 'text/plain'): Promise<void> {
    await this.uploadFile(filePath, text, contentType);
  }

  async uploadImage(filePath: string, imageBuffer: Buffer): Promise<void> {
    const targetBucket = getInitializedBucket();
    await targetBucket.file(filePath).save(imageBuffer, {
      resumable: false,
      metadata: {
        contentType: guessImageContentType(filePath),
        cacheControl: IMAGE_OBJECT_CACHE_CONTROL
      }
    });
  }

  async deleteFile(filePath: string): Promise<void> {
    await getInitializedBucket().file(filePath).delete();
  }

  async listFiles(directoryPath: string): Promise<string[]> {
    const [files] = await getInitializedBucket().getFiles({ prefix: directoryPath });
    return files
      .map((file: File) => file.name)
      .filter((name: string) => !name.endsWith('/'))
      .map((name: string) => name.substring(directoryPath.length).replace(/^\/+/, ''))
      .filter((name: string) => name.length > 0);
  }

  async fileExists(filePath: string): Promise<boolean> {
    const [exists] = await getInitializedBucket().file(filePath).exists();
    return exists;
  }

  async downloadFile(filePath: string): Promise<Buffer> {
    const [bytes] = await getInitializedBucket().file(filePath).download();
    return bytes;
  }

  async downloadJson<T>(filePath: string): Promise<T> {
    const buffer = await this.downloadFile(filePath);
    let text = buffer.toString('utf-8');
    if (text.charCodeAt(0) === 0xfeff) {
      text = text.slice(1);
    }
    text = text.trim();
    try {
      return JSON.parse(text) as T;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const posMatch = /position (\d+)/i.exec(msg);
      const pos = posMatch ? Number(posMatch[1]) : NaN;
      let excerpt = '';
      if (Number.isFinite(pos) && pos >= 0 && pos < text.length) {
        const from = Math.max(0, pos - 60);
        const to = Math.min(text.length, pos + 60);
        excerpt = ` Context around byte ${pos}: ${JSON.stringify(text.slice(from, to))}`;
      }
      throw new Error(`Invalid JSON in ${filePath}: ${msg}.${excerpt}`);
    }
  }

  async getFileCustomMetadata(filePath: string): Promise<Record<string, string> | null> {
    const file = getInitializedBucket().file(filePath);
    const [exists] = await file.exists();
    if (!exists) {
      return null;
    }

    const [metadata] = await file.getMetadata();
    const custom = metadata.metadata as Record<string, string> | undefined;
    return custom || {};
  }

  getResourceUrl(filePath: string): string {
    if (!currentBucketName) {
      throw new Error('Firebase is not initialized with storage bucket configuration.');
    }
    const encodedPath = encodeURIComponent(filePath);
    return `https://firebasestorage.googleapis.com/v0/b/${currentBucketName}/o/${encodedPath}?alt=media`;
  }
}

let firebaseStorageService: FirebaseStorageService | null = null;

export function getFirebaseStorage(): FirebaseStorageService {
  if (!firebaseStorageService) {
    firebaseStorageService = new FirebaseStorageService();
  }
  return firebaseStorageService;
}
