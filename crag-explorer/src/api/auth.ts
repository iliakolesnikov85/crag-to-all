import { readIdToken } from '../auth/firebaseAuth';

/**
 * Bearer token for crag-management writes.
 * This is the Firebase Auth ID token for the signed-in user.
 * Phone auth and Identity Platform are out of scope. Reads stay anonymous.
 * Returns null when nobody is signed in.
 */
export async function getAccessToken(): Promise<string | null> {
  try {
    return await readIdToken();
  } catch (error) {
    console.error('Failed to read the sign-in token:', error);
    return null;
  }
}
