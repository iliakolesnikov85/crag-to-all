import type { CragMemberRole } from '@crag-to-all/shared-crag';

export interface AuthAccount {
  uid: string;
  email: string | null;
  /** Shown name. Null when the user has not set one. */
  displayName?: string | null;
  /** True after the user clicks the Firebase verification link, or signs in with a provider that already verified the email. */
  emailVerified: boolean;
  /** True only when the ID token claim `superadmin` is the boolean `true`. */
  superadmin: boolean;
  /**
   * Memberships loaded at sign-in. Null for a superadmin, who may edit every explorer crag,
   * and when that read failed.
   */
  roles: Readonly<Record<string, CragMemberRole>> | null;
  getIdToken: () => Promise<string>;
}

let account: AuthAccount | null = null;
/** False until the first sign-in answer. A refresh starts here, before Firebase restores the user. */
let authReady = false;
const listeners = new Set<() => void>();

function notify(): void {
  for (const listener of [...listeners]) {
    try {
      listener();
    } catch (error) {
      console.error('Auth session listener failed:', error);
    }
  }
}

export function getAuthAccount(): AuthAccount | null {
  return account;
}

export function isSignedIn(): boolean {
  return account !== null;
}

export function isAuthReady(): boolean {
  return authReady;
}

/** Sign-in has not answered yet. The next `setAuthAccount` marks it ready. */
export function setAuthPending(): void {
  if (!authReady) return;
  authReady = false;
  notify();
}

export function setAuthAccount(next: AuthAccount | null): void {
  const sameAccount = account?.uid === next?.uid
    && account?.email === next?.email
    && account?.displayName === next?.displayName
    && account?.emailVerified === next?.emailVerified
    && account?.superadmin === next?.superadmin
    && account?.roles === next?.roles;
  if (sameAccount && authReady) return;
  account = next;
  authReady = true;
  notify();
}

export function subscribeAuth(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
