import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import {
  FacebookAuthProvider,
  GoogleAuthProvider,
  connectAuthEmulator,
  createUserWithEmailAndPassword,
  getAuth,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  type Auth,
  type User,
} from 'firebase/auth';
import { AUTH_EMULATOR_URL, firebaseWebConfig, isAuthEnabled, useAuthEmulator } from './config';
import { readMemberships } from './memberships';
import { setAuthAccount, type AuthAccount } from './session';

const AUTH_NOT_CONFIGURED = 'Sign-in is not configured.';

let firebaseApp: FirebaseApp | null = null;
let auth: Auth | null = null;
let sessionGeneration = 0;

function emulatorAlreadyConnected(error: unknown): boolean {
  return !!error
    && typeof error === 'object'
    && 'code' in error
    && (error as { code: unknown }).code === 'auth/emulator-config-failed';
}

function firebaseApplication(): FirebaseApp {
  if (firebaseApp) return firebaseApp;
  if (getApps().length > 0) {
    firebaseApp = getApp();
    return firebaseApp;
  }
  const config = firebaseWebConfig();
  if (!config) {
    throw new Error(AUTH_NOT_CONFIGURED);
  }
  firebaseApp = initializeApp(config);
  return firebaseApp;
}

function getFirebaseAuth(): Auth {
  if (!isAuthEnabled()) {
    throw new Error(AUTH_NOT_CONFIGURED);
  }
  if (auth) return auth;
  const next = getAuth(firebaseApplication());
  if (useAuthEmulator()) {
    try {
      connectAuthEmulator(next, AUTH_EMULATOR_URL, { disableWarnings: true });
    } catch (error) {
      if (!emulatorAlreadyConnected(error)) {
        console.error('Failed to connect sign-in:', error);
        throw error;
      }
      // Vite can reload this module after the Auth instance is already connected.
      console.warn('Sign-in was already connected:', error);
    }
  }
  auth = next;
  return auth;
}

async function toAuthAccount(user: User): Promise<AuthAccount> {
  // Refresh once per sign-in, including a page reload. A claim edited in the
  // Auth emulator is copied into this token. Later writes reuse the cached token.
  const result = await user.getIdTokenResult(true);
  const superadmin = result.claims.superadmin === true;
  let roles: AuthAccount['roles'] = null;
  if (!superadmin) {
    try {
      roles = await readMemberships(await user.getIdToken());
    } catch (error) {
      console.error('Failed to read crag membership:', error);
    }
  }
  return {
    uid: user.uid,
    email: user.email,
    superadmin,
    roles,
    getIdToken: () => user.getIdToken(),
  };
}

async function publishAuthAccount(user: User, generation: number): Promise<void> {
  try {
    const account = await toAuthAccount(user);
    if (generation !== sessionGeneration) return;
    setAuthAccount(account);
  } catch (error) {
    console.error('Failed to read sign-in claims:', error);
    if (generation !== sessionGeneration) return;
    setAuthAccount({
      uid: user.uid,
      email: user.email,
      superadmin: false,
      roles: null,
      getIdToken: () => user.getIdToken(),
    });
  }
}

export async function readIdToken(): Promise<string | null> {
  if (!isAuthEnabled()) return null;
  const current = getFirebaseAuth().currentUser;
  if (!current) return null;
  return current.getIdToken();
}

export function startAuthListener(): () => void {
  if (!isAuthEnabled()) {
    return () => undefined;
  }
  return onAuthStateChanged(
    getFirebaseAuth(),
    (user) => {
      const generation = ++sessionGeneration;
      if (!user) {
        setAuthAccount(null);
        return;
      }
      void publishAuthAccount(user, generation);
    },
    (error) => {
      console.error('Firebase Auth state failed:', error);
    },
  );
}

export async function signInWithEmail(email: string, password: string): Promise<void> {
  await signInWithEmailAndPassword(getFirebaseAuth(), email, password);
}

export async function createAccount(
  email: string,
  password: string,
  displayName = '',
): Promise<void> {
  const credential = await createUserWithEmailAndPassword(getFirebaseAuth(), email, password);
  const name = displayName.trim();
  if (!name) return;
  await updateProfile(credential.user, { displayName: name });
}

export async function signInWithGoogle(): Promise<void> {
  await signInWithPopup(getFirebaseAuth(), new GoogleAuthProvider());
}

export async function signInWithFacebook(): Promise<void> {
  const provider = new FacebookAuthProvider();
  provider.addScope('email');
  await signInWithPopup(getFirebaseAuth(), provider);
}

export async function sendPasswordReset(email: string): Promise<void> {
  await sendPasswordResetEmail(getFirebaseAuth(), email);
}

export async function signOutCurrentUser(): Promise<void> {
  await signOut(getFirebaseAuth());
}
