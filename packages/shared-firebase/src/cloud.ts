import { MongoClient, type Db, type Filter } from 'mongodb';

const LOCAL_MONGO_URI = 'mongodb://127.0.0.1:27017';
const DEFAULT_MONGO_DB = 'crag-to-all';
const DEFAULT_FIREBASE_PROJECT_ID = 'crag-to-all';
const DEFAULT_FIREBASE_STORAGE_BUCKET = 'crag-to-all';
const DEFAULT_FIREBASE_STORAGE_EMULATOR_HOST = '127.0.0.1:9199';
const DEFAULT_FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';

function envString(name: string): string | undefined {
  const value = process.env[name];
  if (!value) return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function envBool(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (!raw || !raw.trim()) return fallback;
  const value = raw.trim().toLowerCase();
  if (value === '1' || value === 'true' || value === 'yes') return true;
  if (value === '0' || value === 'false' || value === 'no') return false;
  throw new Error(`${name} must be a boolean`);
}

function uriHasUser(uri: string): boolean {
  try {
    return Boolean(new URL(uri).username);
  } catch {
    return uri.includes('@');
  }
}

/** Hides userinfo. The last `@` in each authority separates credentials from the host. */
function redactMongoUri(uri: string): string {
  return uri.replace(/mongodb(?:\+srv)?:\/\/([^/?#\s]*)/gi, (match, authority: string) => {
    const at = authority.lastIndexOf('@');
    if (at < 0) return match;
    const scheme = match.slice(0, match.length - authority.length);
    return `${scheme}***:***@${authority.slice(at + 1)}`;
  });
}

function redactError(error: unknown, uri: string): Error {
  const message = error instanceof Error ? error.message : String(error);
  const scrub = (text: string) => redactMongoUri(text.split(uri).join(redactMongoUri(uri)));
  const redacted = new Error(scrub(message));
  if (error instanceof Error) {
    redacted.name = error.name;
    if (error.stack) redacted.stack = scrub(error.stack);
  }
  return redacted;
}

function needsMongoCredentials(uri: string): boolean {
  try {
    const parsed = new URL(uri);
    return parsed.protocol === 'mongodb+srv:' || parsed.hostname.endsWith('.mongodb.net');
  } catch {
    return uri.startsWith('mongodb+srv:') || uri.includes('.mongodb.net');
  }
}

function readMongo(local: boolean): MongoSettings {
  if (local) {
    return { uri: LOCAL_MONGO_URI, db: DEFAULT_MONGO_DB };
  }

  const uri = envString('MONGODB_URI') ?? LOCAL_MONGO_URI;
  const db = envString('MONGODB_DB') ?? DEFAULT_MONGO_DB;
  if (needsMongoCredentials(uri) && !uriHasUser(uri)) {
    throw new Error('Atlas MONGODB_URI must include the database user and password.');
  }
  return { uri, db };
}

function readFirebase(local: boolean | undefined, fallbackUseEmulator: boolean): FirebaseSettings {
  // An explicit pipeline run chooses the emulator only for `--dev-local`.
  // `FIREBASE_USE_EMULATOR` is the API switch and applies when `local` is omitted.
  const useEmulator = local ?? envBool('FIREBASE_USE_EMULATOR', fallbackUseEmulator);
  return {
    useEmulator,
    projectId: envString('FIREBASE_PROJECT_ID') ?? DEFAULT_FIREBASE_PROJECT_ID,
    storageBucket: envString('FIREBASE_STORAGE_BUCKET_v2') ?? DEFAULT_FIREBASE_STORAGE_BUCKET,
    storageEmulatorHost:
      envString('FIREBASE_STORAGE_EMULATOR_HOST') ?? DEFAULT_FIREBASE_STORAGE_EMULATOR_HOST,
    authEmulatorHost: envString('FIREBASE_AUTH_EMULATOR_HOST') ?? DEFAULT_FIREBASE_AUTH_EMULATOR_HOST,
  };
}

/** `MONGODB_URI` as given. An Atlas URI includes the database user and password. */
export interface MongoSettings {
  uri: string;
  db: string;
}

export interface FirebaseSettings {
  useEmulator: boolean;
  projectId: string;
  storageBucket: string;
  storageEmulatorHost: string;
  authEmulatorHost: string;
}

export interface CloudConfig {
  mongo: MongoSettings;
  firebase: FirebaseSettings;
}

export interface ReadCloudConfigOptions {
  /**
   * Pipeline `--dev-local`. `true` uses localhost Mongo and the Firebase emulators.
   * `false` uses `MONGODB_URI` and production Firebase. Omit it to follow `FIREBASE_USE_EMULATOR`.
   */
  local?: boolean;
  /** Used when `local` is omitted and `FIREBASE_USE_EMULATOR` is unset. */
  firebaseUseEmulator?: boolean;
}

export function readCloudConfig(options: ReadCloudConfigOptions = {}): CloudConfig {
  return {
    mongo: readMongo(options.local === true),
    firebase: readFirebase(options.local, options.firebaseUseEmulator ?? false),
  };
}

/** Copies Firebase settings onto `process.env` for `initializeFirebase`. */
export function applyFirebaseEnv(firebase: FirebaseSettings): void {
  process.env.FIREBASE_PROJECT_ID = firebase.projectId;
  process.env.FIREBASE_STORAGE_BUCKET_v2 = firebase.storageBucket;
  if (firebase.useEmulator) {
    process.env.FIREBASE_STORAGE_EMULATOR_HOST = firebase.storageEmulatorHost;
    process.env.FIREBASE_AUTH_EMULATOR_HOST = firebase.authEmulatorHost;
    return;
  }
  delete process.env.FIREBASE_STORAGE_EMULATOR_HOST;
  delete process.env.FIREBASE_AUTH_EMULATOR_HOST;
}

export { MongoClient };
export type { Db, Filter };

export async function connectMongo(mongo: MongoSettings): Promise<MongoClient> {
  let client: MongoClient | undefined;
  try {
    client = new MongoClient(mongo.uri);
    await client.connect();
    return client;
  } catch (error) {
    const redacted = redactError(error, mongo.uri);
    const hint = uriHasUser(mongo.uri) ? '' : ' Start local MongoDB and retry.';
    console.error(
      `Cannot connect to MongoDB at ${redactMongoUri(mongo.uri)} (database "${mongo.db}").${hint}`,
      redacted,
    );
    if (client) {
      try {
        await client.close();
      } catch (closeError) {
        console.error('Failed to close MongoDB client after connect error:', closeError);
      }
    }
    throw redacted;
  }
}
