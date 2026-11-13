import type { CragMemberRole } from '@crag-to-all/shared-crag';

export interface AuthAccount {
  uid: string;
  email: string | null;
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

export function setAuthAccount(next: AuthAccount | null): void {
  if (
    account?.uid === next?.uid
    && account?.email === next?.email
    && account?.superadmin === next?.superadmin
    && account?.roles === next?.roles
  ) return;
  account = next;
  notify();
}

export function subscribeAuth(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
