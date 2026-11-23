import { resolve } from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getAdminApp } from './admin';

const fsMocks = vi.hoisted(() => ({
  existsSync: vi.fn(() => true),
  readFileSync: vi.fn(() => {
    throw new Error('should not read a key file');
  }),
}));

const adminMocks = vi.hoisted(() => ({
  getApps: vi.fn(() => [] as { name: string }[]),
  initializeApp: vi.fn(() => ({ name: 'test-app' })),
  cert: vi.fn((account: unknown) => ({ account })),
}));

vi.mock('fs', () => ({
  existsSync: fsMocks.existsSync,
  readFileSync: fsMocks.readFileSync,
}));

vi.mock('firebase-admin/app', () => ({
  cert: adminMocks.cert,
  getApps: adminMocks.getApps,
  initializeApp: adminMocks.initializeApp,
}));

const CREDENTIAL_KEYS = ['FIREBASE_SERVICE_ACCOUNT_KEY', 'FIREBASE_SERVICE_ACCOUNT_KEY_PATH'] as const;
const previous = new Map<string, string | undefined>();

function clearCredentialEnv(): void {
  for (const key of CREDENTIAL_KEYS) {
    if (!previous.has(key)) previous.set(key, process.env[key]);
    delete process.env[key];
  }
}

afterEach(() => {
  for (const [key, value] of previous) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  previous.clear();
  fsMocks.existsSync.mockClear();
  fsMocks.readFileSync.mockClear();
  adminMocks.getApps.mockClear();
  adminMocks.initializeApp.mockClear();
  adminMocks.cert.mockClear();
});

describe('getAdminApp credentials', () => {
  it('does not read firebase-account.json when no credential env is set', () => {
    clearCredentialEnv();
    fsMocks.existsSync.mockReturnValue(true);

    expect(() => getAdminApp(false)).toThrow(/Set FIREBASE_SERVICE_ACCOUNT_KEY or FIREBASE_SERVICE_ACCOUNT_KEY_PATH/);
    expect(fsMocks.existsSync).not.toHaveBeenCalled();
    expect(fsMocks.readFileSync).not.toHaveBeenCalled();
    expect(adminMocks.initializeApp).not.toHaveBeenCalled();
  });

  it('uses FIREBASE_SERVICE_ACCOUNT_KEY without reading a key file', () => {
    clearCredentialEnv();
    process.env.FIREBASE_SERVICE_ACCOUNT_KEY = JSON.stringify({
      type: 'service_account',
      project_id: 'crag-to-all',
      private_key: '-----BEGIN PRIVATE KEY-----\\nabc\\n-----END PRIVATE KEY-----\\n',
      client_email: 'api@crag-to-all.iam.gserviceaccount.com',
    });

    getAdminApp(false);

    expect(fsMocks.readFileSync).not.toHaveBeenCalled();
    expect(adminMocks.cert).toHaveBeenCalledWith(expect.objectContaining({
      projectId: 'crag-to-all',
      clientEmail: 'api@crag-to-all.iam.gserviceaccount.com',
    }));
    expect(adminMocks.initializeApp).toHaveBeenCalledTimes(1);
  });

  it('reads FIREBASE_SERVICE_ACCOUNT_KEY_PATH from that path only', () => {
    clearCredentialEnv();
    process.env.FIREBASE_SERVICE_ACCOUNT_KEY_PATH = 'missing-key.json';
    fsMocks.readFileSync.mockImplementation(() => {
      throw new Error('ENOENT');
    });
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      expect(() => getAdminApp(false)).toThrow(
        /Could not read FIREBASE_SERVICE_ACCOUNT_KEY_PATH \(.*missing-key\.json\)/,
      );
      expect(fsMocks.existsSync).not.toHaveBeenCalled();
      expect(fsMocks.readFileSync).toHaveBeenCalledTimes(1);
      expect(fsMocks.readFileSync.mock.calls[0]?.[0]).toBe(resolve('missing-key.json'));
      expect(adminMocks.initializeApp).not.toHaveBeenCalled();
    } finally {
      fsMocks.readFileSync.mockImplementation(() => {
        throw new Error('should not read a key file');
      });
      error.mockRestore();
    }
  });
});
