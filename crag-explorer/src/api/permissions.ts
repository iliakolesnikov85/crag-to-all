import { getAuthAccount } from '../auth/session';
import type { CragSource } from '../types';

/**
 * A superadmin may edit every explorer crag.
 * An owner or admin may edit a crag in the membership list loaded at sign-in.
 */
export function canManageCrag(cragId: string): boolean {
  const account = getAuthAccount();
  if (!account) return false;
  if (account.superadmin) return true;
  const role = account.roles?.[cragId];
  return role === 'owner' || role === 'admin';
}

/** Extracted crags stay read-only for every signed-in user, including a superadmin. */
export function canEditCrag(crag: { cragId: string; source?: CragSource }): boolean {
  return crag.source !== 'external' && canManageCrag(crag.cragId);
}
