import { useSyncExternalStore } from 'react';
import { canEditCrag, canManageMembers } from '../api/permissions';
import type { CragSource } from '../types';
import { getAuthAccount, subscribeAuth, type AuthAccount } from './session';

export function useAuthSession(): AuthAccount | null {
  return useSyncExternalStore(subscribeAuth, getAuthAccount, getAuthAccount);
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
