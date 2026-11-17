import { afterEach, describe, expect, it, vi } from 'vitest';
import { applyFirebaseEnv, connectMongo, readCloudConfig } from './cloud';

const CLOUD_KEYS = [
  'MONGODB_URI',
  'MONGODB_DB',
  'FIREBASE_USE_EMULATOR',
  'FIREBASE_PROJECT_ID',
  'FIREBASE_STORAGE_BUCKET_v2',
  'FIREBASE_STORAGE_EMULATOR_HOST',
  'FIREBASE_AUTH_EMULATOR_HOST',
] as const;

const previous = new Map<string, string | undefined>();

function useEnv(values: Record<string, string>): void {
  for (const key of CLOUD_KEYS) {
    if (!previous.has(key)) previous.set(key, process.env[key]);
    delete process.env[key];
  }
  Object.assign(process.env, values);
}

afterEach(() => {
  for (const [key, value] of previous) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  previous.clear();
});

describe('readCloudConfig', () => {
  it('uses localhost Mongo and the Firebase emulators for a local run', () => {
    useEnv({
      MONGODB_URI: 'mongodb+srv://atlas-user:secret@cluster0.example.mongodb.net',
      MONGODB_DB: 'other',
      FIREBASE_USE_EMULATOR: 'false',
    });
    const cloud = readCloudConfig({ local: true });
    expect(cloud.mongo).toEqual({
      uri: 'mongodb://127.0.0.1:27017',
      db: 'crag-to-all',
    });
    expect(cloud.firebase.useEmulator).toBe(true);
  });

  it('defaults to localhost Mongo with the Firebase emulators off', () => {
    useEnv({});
    const cloud = readCloudConfig();
    expect(cloud.mongo).toEqual({
      uri: 'mongodb://127.0.0.1:27017',
      db: 'crag-to-all',
    });
    expect(cloud.firebase.useEmulator).toBe(false);
  });

  it('keeps an Atlas URI and rejects one that has no user', () => {
    const uri = 'mongodb+srv://atlas-user:p%40ss%3Aword@cluster0.example.mongodb.net/crag?retryWrites=true&w=majority';
    useEnv({ MONGODB_URI: uri });
    expect(readCloudConfig().mongo.uri).toBe(uri);

    useEnv({ MONGODB_URI: 'mongodb+srv://cluster0.example.mongodb.net/crag-to-all' });
    expect(() => readCloudConfig()).toThrow(/must include the database user and password/);
  });

  it('uses production Firebase for a non-local run when the emulator env var is set', () => {
    useEnv({ FIREBASE_USE_EMULATOR: 'true' });
    expect(readCloudConfig({ local: false }).firebase.useEmulator).toBe(false);
  });

  it('follows the caller emulator default when the env var is unset', () => {
    useEnv({});
    expect(readCloudConfig({ firebaseUseEmulator: true }).firebase.useEmulator).toBe(true);
  });
});

describe('connectMongo', () => {
  it('logs a refused connection without the password', async () => {
    const uri = 'mongodb://atlas-user:p@ss@127.0.0.1:1/crag?serverSelectionTimeoutMS=300';
    const lines: string[] = [];
    const spy = vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
      lines.push(args.map((arg) => (arg instanceof Error ? arg.stack ?? arg.message : String(arg))).join(' '));
    });
    try {
      await expect(connectMongo({ uri, db: 'crag-to-all' })).rejects.toThrow();
    } finally {
      spy.mockRestore();
    }
    const logged = lines.join('\n');
    expect(logged).toContain('***:***@127.0.0.1:1');
    expect(logged).not.toContain('p@ss');
    expect(logged).not.toContain('p%40ss');
    expect(logged).not.toContain('atlas-user');
  });
});

describe('applyFirebaseEnv', () => {
  it('clears emulator hosts outside local mode', () => {
    useEnv({
      FIREBASE_STORAGE_EMULATOR_HOST: '127.0.0.1:9199',
      FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9099',
    });
    const cloud = readCloudConfig({ firebaseUseEmulator: false });
    applyFirebaseEnv(cloud.firebase);
    expect(process.env.FIREBASE_PROJECT_ID).toBe('crag-to-all');
    expect(process.env.FIREBASE_STORAGE_BUCKET_v2).toBe('crag-to-all');
    expect(process.env.FIREBASE_STORAGE_EMULATOR_HOST).toBeUndefined();
    expect(process.env.FIREBASE_AUTH_EMULATOR_HOST).toBeUndefined();
  });
});
