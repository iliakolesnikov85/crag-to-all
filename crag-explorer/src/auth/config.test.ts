import { afterEach, describe, expect, it, vi } from 'vitest';
import { firebaseWebConfig, isAuthEnabled, useAuthEmulator } from './config';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('auth config', () => {
  it('uses the demo config on dev-local', () => {
    vi.stubEnv('VITE_DEV_LOCAL', 'true');
    vi.stubEnv('VITE_FIREBASE_API_KEY', 'real-api-key');
    expect(useAuthEmulator()).toBe(true);
    expect(firebaseWebConfig()).toEqual({
      apiKey: 'demo-api-key',
      authDomain: 'crag-to-all.firebaseapp.com',
      projectId: 'crag-to-all',
    });
    expect(isAuthEnabled()).toBe(true);
  });

  it('uses the production web config when every value is set', () => {
    vi.stubEnv('VITE_FIREBASE_API_KEY', ' real-api-key ');
    vi.stubEnv('VITE_FIREBASE_AUTH_DOMAIN', 'crag-to-all.firebaseapp.com');
    vi.stubEnv('VITE_FIREBASE_PROJECT_ID', 'crag-to-all');
    vi.stubEnv('VITE_FIREBASE_APP_ID', '1:123:web:abc');
    expect(useAuthEmulator()).toBe(false);
    expect(firebaseWebConfig()).toEqual({
      apiKey: 'real-api-key',
      authDomain: 'crag-to-all.firebaseapp.com',
      projectId: 'crag-to-all',
      appId: '1:123:web:abc',
    });
    expect(isAuthEnabled()).toBe(true);
  });

  it('stays off when the production web config is incomplete', () => {
    vi.stubEnv('VITE_FIREBASE_API_KEY', 'real-api-key');
    expect(firebaseWebConfig()).toBeNull();
    expect(isAuthEnabled()).toBe(false);
  });
});
