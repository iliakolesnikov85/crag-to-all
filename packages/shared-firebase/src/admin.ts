import { existsSync, readFileSync } from 'fs';
import { isAbsolute, resolve } from 'path';
import { App, cert, getApps, initializeApp, type ServiceAccount } from 'firebase-admin/app';

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
    } catch (error) {
      console.error('Failed to read Firebase service account file:', error);
      throw new Error(
        `Could not read FIREBASE_SERVICE_ACCOUNT_KEY_PATH (${resolvedPath}): ${error instanceof Error ? error.message : String(error)}`
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
  } catch (error) {
    console.error('Failed to parse Firebase service account JSON:', error);
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

/** The default Firebase Admin app. Storage and Auth both use this app. */
export function getAdminApp(useEmulator: boolean): App {
  if (useEmulator) {
    process.env.FIREBASE_STORAGE_EMULATOR_HOST = process.env.FIREBASE_STORAGE_EMULATOR_HOST || '127.0.0.1:9199';
    process.env.FIREBASE_AUTH_EMULATOR_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9099';
  }

  const existingApp = getApps()[0];
  if (existingApp) {
    return existingApp;
  }

  const defaultProjectId = process.env.FIREBASE_PROJECT_ID || 'crag-to-all';
  const defaultBucket = process.env.FIREBASE_STORAGE_BUCKET || 'crag-to-all.firebasestorage.app';

  if (useEmulator) {
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
