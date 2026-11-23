import type { Db } from '@crag-to-all/shared-firebase';
import type { AuthCaller } from '../types';
import { membersCol } from './collections';

/** A missing flag is public. Only an explicit false is hidden. */
export function isPublicCrag(doc: { published?: boolean }): boolean {
  return doc.published !== false;
}

export async function hasWriteMembership(db: Db, cragId: string, userId: string): Promise<boolean> {
  const member = await membersCol(db).findOne(
    { cragId, userId },
    { projection: { role: 1 } },
  );
  return member?.role === 'owner' || member?.role === 'admin';
}

/**
 * A public crag is readable by anyone.
 * A hidden crag is readable by a superadmin, or by an owner or admin.
 */
export async function canReadCrag(
  db: Db,
  crag: { _id: string; published?: boolean },
  caller: AuthCaller | null,
): Promise<boolean> {
  if (isPublicCrag(crag)) return true;
  if (!caller) return false;
  if (caller.superadmin) return true;
  return hasWriteMembership(db, crag._id, caller.uid);
}
