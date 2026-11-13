import { describe, expect, it, vi } from 'vitest';
import { getAuthAccount, isSignedIn, setAuthAccount } from './session';
import {
  createAccount,
  readIdToken,
  sendPasswordReset,
  signInWithEmail,
  signInWithGoogle,
  signOutCurrentUser,
  startAuthListener,
} from './firebaseAuth';

const firebaseMocks = vi.hoisted(() => {
  class GoogleAuthProvider {}

  const authInstance: {
    currentUser: { getIdToken: () => Promise<string> } | null;
  } = { currentUser: null };

  return {
    GoogleAuthProvider,
    authInstance,
    initializeApp: vi.fn(() => ({ name: '[DEFAULT]' })),
    getApps: vi.fn(() => []),
    getApp: vi.fn(() => ({ name: '[DEFAULT]' })),
    getAuth: vi.fn(() => authInstance),
    connectAuthEmulator: vi.fn(),
    signInWithEmailAndPassword: vi.fn(async () => ({})),
    createUserWithEmailAndPassword: vi.fn(async () => ({})),
    signInWithPopup: vi.fn(async (_auth: unknown, _provider: object) => ({})),
    sendPasswordResetEmail: vi.fn(async () => undefined),
    signOut: vi.fn(async () => undefined),
    onAuthStateChanged: vi.fn((
      _auth: unknown,
      _next: (user: unknown) => void,
      _error?: (failure: unknown) => void,
    ) => () => undefined),
    useAuthEmulator: vi.fn(() => true),
  };
});

vi.mock('firebase/app', () => ({
  getApp: firebaseMocks.getApp,
  getApps: firebaseMocks.getApps,
  initializeApp: firebaseMocks.initializeApp,
}));

vi.mock('firebase/auth', () => ({
  GoogleAuthProvider: firebaseMocks.GoogleAuthProvider,
  connectAuthEmulator: firebaseMocks.connectAuthEmulator,
  createUserWithEmailAndPassword: firebaseMocks.createUserWithEmailAndPassword,
  getAuth: firebaseMocks.getAuth,
  onAuthStateChanged: firebaseMocks.onAuthStateChanged,
  sendPasswordResetEmail: firebaseMocks.sendPasswordResetEmail,
  signInWithEmailAndPassword: firebaseMocks.signInWithEmailAndPassword,
  signInWithPopup: firebaseMocks.signInWithPopup,
  signOut: firebaseMocks.signOut,
}));

vi.mock('./config', () => ({
  AUTH_EMULATOR_URL: 'http://127.0.0.1:9099',
  useAuthEmulator: firebaseMocks.useAuthEmulator,
}));

describe('firebaseAuth', () => {
  it('connects the Auth emulator once and signs in against it', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    firebaseMocks.useAuthEmulator.mockReturnValue(true);

    try {
      await expect(readIdToken()).resolves.toBeNull();
      await signInWithEmail('ada@example.com', 'secret1');

      expect(firebaseMocks.initializeApp).toHaveBeenCalledTimes(1);
      expect(firebaseMocks.initializeApp).toHaveBeenCalledWith({
        apiKey: 'demo-api-key',
        authDomain: 'crag-to-all.firebaseapp.com',
        projectId: 'crag-to-all',
      });
      expect(firebaseMocks.connectAuthEmulator).toHaveBeenCalledTimes(1);
      expect(firebaseMocks.connectAuthEmulator).toHaveBeenCalledWith(
        firebaseMocks.authInstance,
        'http://127.0.0.1:9099',
        { disableWarnings: true },
      );
      expect(firebaseMocks.signInWithEmailAndPassword).toHaveBeenCalledWith(
        firebaseMocks.authInstance,
        'ada@example.com',
        'secret1',
      );
      await createAccount('new@example.com', 'secret1');
      expect(firebaseMocks.createUserWithEmailAndPassword).toHaveBeenCalledWith(
        firebaseMocks.authInstance,
        'new@example.com',
        'secret1',
      );

      await signInWithGoogle();
      const popupCall = firebaseMocks.signInWithPopup.mock.calls[0];
      expect(popupCall?.[0]).toBe(firebaseMocks.authInstance);
      expect(popupCall?.[1]).toBeInstanceOf(firebaseMocks.GoogleAuthProvider);

      await sendPasswordReset('ada@example.com');
      expect(firebaseMocks.sendPasswordResetEmail).toHaveBeenCalledWith(
        firebaseMocks.authInstance,
        'ada@example.com',
      );

      await signOutCurrentUser();
      expect(firebaseMocks.signOut).toHaveBeenCalledWith(firebaseMocks.authInstance);
      expect(firebaseMocks.connectAuthEmulator).toHaveBeenCalledTimes(1);
      expect(firebaseMocks.initializeApp).toHaveBeenCalledTimes(1);

      await expect(readIdToken()).resolves.toBeNull();
      firebaseMocks.authInstance.currentUser = { getIdToken: async () => 'id-token' };
      await expect(readIdToken()).resolves.toBe('id-token');

      type FirebaseUser = {
        uid: string;
        email: string | null;
        getIdToken: () => Promise<string>;
        getIdTokenResult: (forceRefresh?: boolean) => Promise<{ claims: { superadmin?: unknown } }>;
      };
      let observer: ((user: FirebaseUser | null) => void) | undefined;
      let onError: ((failure: Error) => void) | undefined;
      firebaseMocks.onAuthStateChanged.mockImplementation((
        _auth: unknown,
        next: (user: FirebaseUser | null) => void,
        failure?: (listenerError: Error) => void,
      ) => {
        observer = next;
        onError = failure;
        return () => {
          observer = undefined;
        };
      });

      const stop = startAuthListener();
      observer?.(null);
      expect(isSignedIn()).toBe(false);
      const superadminToken = vi.fn(async () => ({ claims: { superadmin: true } }));
      observer?.({
        uid: 'user-1',
        email: 'ada@example.com',
        getIdToken: async () => 'token',
        getIdTokenResult: superadminToken,
      });
      await vi.waitFor(() => {
        expect(getAuthAccount()?.superadmin).toBe(true);
      });
      expect(superadminToken).toHaveBeenCalledWith(true);
      onError?.(new Error('listener down'));
      expect(error).toHaveBeenCalledWith('Firebase Auth state failed:', expect.any(Error));
      observer?.({
        uid: 'user-1',
        email: 'ada@example.com',
        getIdToken: async () => 'token',
        getIdTokenResult: async () => ({ claims: { superadmin: 'true' } }),
      });
      await vi.waitFor(() => {
        expect(getAuthAccount()?.superadmin).toBe(false);
      });
      expect(isSignedIn()).toBe(true);
      expect(getAuthAccount()?.roles).toBeNull();
      expect(error).toHaveBeenCalledWith('Failed to read crag membership:', expect.any(Error));
      observer?.({
        uid: 'user-2',
        email: 'bea@example.com',
        getIdToken: async () => 'token',
        getIdTokenResult: async () => {
          throw new Error('claims unavailable');
        },
      });
      await vi.waitFor(() => {
        expect(getAuthAccount()?.uid).toBe('user-2');
      });
      expect(getAuthAccount()?.superadmin).toBe(false);
      expect(error).toHaveBeenCalledWith('Failed to read sign-in claims:', expect.any(Error));
      observer?.(null);
      expect(isSignedIn()).toBe(false);
      stop();
      expect(observer).toBeUndefined();
    } finally {
      firebaseMocks.authInstance.currentUser = null;
      firebaseMocks.useAuthEmulator.mockReturnValue(true);
      setAuthAccount(null);
      error.mockRestore();
    }
  });

  it('does not contact Firebase Auth when the local emulator is off', async () => {
    vi.resetModules();
    firebaseMocks.useAuthEmulator.mockReturnValue(false);
    firebaseMocks.connectAuthEmulator.mockClear();
    firebaseMocks.initializeApp.mockClear();
    firebaseMocks.getAuth.mockClear();
    firebaseMocks.signInWithEmailAndPassword.mockClear();
    firebaseMocks.createUserWithEmailAndPassword.mockClear();
    firebaseMocks.signInWithPopup.mockClear();
    firebaseMocks.sendPasswordResetEmail.mockClear();
    firebaseMocks.signOut.mockClear();
    firebaseMocks.onAuthStateChanged.mockClear();

    const auth = await import('./firebaseAuth');
    try {
      await expect(auth.signInWithEmail('ada@example.com', 'secret1')).rejects.toThrow(
        /local Auth emulator/,
      );
      await expect(auth.createAccount('ada@example.com', 'secret1')).rejects.toThrow(
        /local Auth emulator/,
      );
      await expect(auth.signInWithGoogle()).rejects.toThrow(/local Auth emulator/);
      await expect(auth.sendPasswordReset('ada@example.com')).rejects.toThrow(/local Auth emulator/);
      await expect(auth.signOutCurrentUser()).rejects.toThrow(/local Auth emulator/);
      await expect(auth.readIdToken()).resolves.toBeNull();
      auth.startAuthListener()();

      expect(firebaseMocks.initializeApp).not.toHaveBeenCalled();
      expect(firebaseMocks.getAuth).not.toHaveBeenCalled();
      expect(firebaseMocks.connectAuthEmulator).not.toHaveBeenCalled();
      expect(firebaseMocks.signInWithEmailAndPassword).not.toHaveBeenCalled();
      expect(firebaseMocks.createUserWithEmailAndPassword).not.toHaveBeenCalled();
      expect(firebaseMocks.signInWithPopup).not.toHaveBeenCalled();
      expect(firebaseMocks.sendPasswordResetEmail).not.toHaveBeenCalled();
      expect(firebaseMocks.signOut).not.toHaveBeenCalled();
      expect(firebaseMocks.onAuthStateChanged).not.toHaveBeenCalled();
    } finally {
      firebaseMocks.useAuthEmulator.mockReturnValue(true);
    }
  });
});
