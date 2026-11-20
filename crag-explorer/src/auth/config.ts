interface FirebaseWebConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  appId?: string;
}

const DEMO_WEB_CONFIG: FirebaseWebConfig = {
  apiKey: 'demo-api-key',
  authDomain: 'crag-to-all.firebaseapp.com',
  projectId: 'crag-to-all',
};

function trimmedEnv(value: string | undefined): string {
  return value?.trim() ?? '';
}

/** Auth emulator used by `npm run dev-local`. */
export const AUTH_EMULATOR_URL = 'http://127.0.0.1:9099';

export type { FirebaseWebConfig };

export function useAuthEmulator(): boolean {
  return import.meta.env.VITE_DEV_LOCAL === 'true';
}

/** Demo config on `dev-local`. Otherwise the public web app config, or null when it is incomplete. */
export function firebaseWebConfig(): FirebaseWebConfig | null {
  if (useAuthEmulator()) return DEMO_WEB_CONFIG;
  const apiKey = trimmedEnv(import.meta.env.VITE_FIREBASE_API_KEY);
  const authDomain = trimmedEnv(import.meta.env.VITE_FIREBASE_AUTH_DOMAIN);
  const projectId = trimmedEnv(import.meta.env.VITE_FIREBASE_PROJECT_ID);
  const appId = trimmedEnv(import.meta.env.VITE_FIREBASE_APP_ID);
  if (!apiKey || !authDomain || !projectId || !appId) return null;
  return { apiKey, authDomain, projectId, appId };
}

export function isAuthEnabled(): boolean {
  return firebaseWebConfig() !== null;
}
