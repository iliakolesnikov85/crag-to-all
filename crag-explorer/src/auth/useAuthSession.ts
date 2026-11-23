import { useSyncExternalStore } from 'react';
import { canEditCrag, canManageMembers } from '../api/permissions';
import type { CragSource } from '../types';
import { getAuthAccount, isAuthReady, subscribeAuth, type AuthAccount } from './session';

export function useAuthSession(): AuthAccount | null {
  return useSyncExternalStore(subscribeAuth, getAuthAccount, getAuthAccount);
}

/** False on a fresh load, until Firebase has restored or cleared the signed-in user. */
export function useAuthReady(): boolean {
  return useSyncExternalStore(subscribeAuth, isAuthReady, isAuthReady);
}

/** Subscribe to the signed-in user, then apply crag edit rules. */
export function useCanEditCrag(crag: { id: string; source?: CragSource }): boolean {
  useAuthSession();
  return canEditCrag(crag);
}

/** Subscribe to the signed-in user, then apply membership write rules. */
export function useCanManageMembers(cragId: string): boolean {
  useAuthSession();
  return canManageMembers(cragId);
}
