/** Auth emulator used by `npm run dev-local`. Other builds do not contact Firebase Auth. */
export const AUTH_EMULATOR_URL = 'http://127.0.0.1:9099';

export function useAuthEmulator(): boolean {
  return import.meta.env.VITE_DEV_LOCAL === 'true';
}
