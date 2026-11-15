import { getAuth, type DecodedIdToken, type UserRecord } from 'firebase-admin/auth';

const AUTH_GET_USERS_LIMIT = 100;

function blankToNull(value: string | undefined): string | null {
  const trimmed = value?.trim() ?? '';
  return trimmed.length > 0 ? trimmed : null;
}

function profileFromUser(user: UserRecord): FirebaseAuthProfile {
  return {
    uid: user.uid,
    email: blankToNull(user.email),
    emailVerified: user.emailVerified === true,
    name: blankToNull(user.displayName),
  };
}

function isAuthUserNotFound(error: unknown): boolean {
  return (
    typeof error === 'object'
    && error !== null
    && 'code' in error
    && (error as { code: unknown }).code === 'auth/user-not-found'
  );
}

/** Firebase Auth profile used to label a crag member or resolve an email. */
export interface FirebaseAuthProfile {
  uid: string;
  email: string | null;
  emailVerified: boolean;
  name: string | null;
}

/** Checks a Firebase ID token and returns its claims. Emulator tokens verify when `FIREBASE_AUTH_EMULATOR_HOST` is set. */
export async function verifyFirebaseIdToken(idToken: string): Promise<DecodedIdToken> {
  return getAuth().verifyIdToken(idToken);
}

/** Exact email lookup. Null when Firebase Auth has no user with that address. */
export async function findFirebaseUserByEmail(email: string): Promise<FirebaseAuthProfile | null> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return null;
  try {
    return profileFromUser(await getAuth().getUserByEmail(normalized));
  } catch (error) {
    if (isAuthUserNotFound(error)) return null;
    console.error('Failed to look up a Firebase user by email:', error);
    throw error;
  }
}

/** Reads Auth profiles for these uids. Missing users are omitted. At most 100 uids per Auth call. */
export async function getFirebaseUsersByUid(uids: readonly string[]): Promise<FirebaseAuthProfile[]> {
  const unique = [...new Set(uids.map((uid) => uid.trim()).filter((uid) => uid.length > 0))];
  if (unique.length === 0) return [];
  const auth = getAuth();
  const profiles: FirebaseAuthProfile[] = [];
  try {
    for (let index = 0; index < unique.length; index += AUTH_GET_USERS_LIMIT) {
      const chunk = unique.slice(index, index + AUTH_GET_USERS_LIMIT);
      const result = await auth.getUsers(chunk.map((uid) => ({ uid })));
      for (const user of result.users) {
        profiles.push(profileFromUser(user));
      }
    }
  } catch (error) {
    console.error('Failed to read Firebase users by uid:', error);
    throw error;
  }
  return profiles;
}

/**
 * Sets the custom claim `superadmin` to the boolean `true` for one user.
 * Other custom claims are kept. Call `initializeFirebase(false)` first.
 * This is not used by HTTP handlers. The user's current ID token stays old
 * until they sign in again or the client calls `getIdToken(true)`.
 */
export async function setSuperadminClaim(uid: string): Promise<{ projectId: string }> {
  const trimmed = uid.trim();
  if (!trimmed) {
    throw new Error('A Firebase uid is required to set the superadmin claim.');
  }
  const auth = getAuth();
  const user = await auth.getUser(trimmed);
  await auth.setCustomUserClaims(trimmed, {
    ...(user.customClaims ?? {}),
    superadmin: true,
  });
  const updated = await auth.getUser(trimmed);
  if (updated.customClaims?.superadmin !== true) {
    throw new Error(`Custom claim superadmin was not stored as boolean true for ${trimmed}`);
  }
  return { projectId: auth.app.options.projectId ?? '' };
}
