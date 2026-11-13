import type { Db } from 'mongodb';
import { forbidden, isDuplicateKeyError, notFound, readOnly } from '../http';
import type { AuthCaller, CragMemberResponse, CragMemberRole } from '../types';
import { cragsCol, membersCol } from './collections';

/** The crag must exist and be an explorer crag. Extracted crags stay read-only for every role. */
async function requireExplorerCrag(db: Db, cragId: string): Promise<void> {
  const crag = await cragsCol(db).findOne({ _id: cragId }, { projection: { source: 1 } });
  if (!crag) throw notFound('crag');
  if (crag.source === 'external') {
    throw readOnly('An extracted crag is read-only');
  }
}

/** Superadmin or an owner of this crag. An admin, or a user with no row, is forbidden. */
async function requireMemberManager(db: Db, cragId: string, caller: AuthCaller): Promise<void> {
  await requireExplorerCrag(db, cragId);
  if (caller.superadmin) return;
  const member = await membersCol(db).findOne(
    { cragId, userId: caller.uid },
    { projection: { role: 1 } },
  );
  if (member?.role !== 'owner') {
    throw forbidden();
  }
}

/**
 * An owner may set `admin` only, and may not change an existing owner, including themselves.
 * A superadmin may set either role.
 */
function assertCanSetRole(
  caller: AuthCaller,
  role: CragMemberRole,
  existingRole: CragMemberRole | undefined,
): void {
  if (caller.superadmin) return;
  if (role !== 'admin' || existingRole === 'owner') {
    throw forbidden();
  }
}

/** An owner may remove an admin only. A superadmin may remove either role. */
function assertCanRemove(caller: AuthCaller, existingRole: CragMemberRole): void {
  if (caller.superadmin) return;
  if (existingRole !== 'admin') {
    throw forbidden();
  }
}

async function saveMemberRole(
  db: Db,
  cragId: string,
  userId: string,
  role: CragMemberRole,
  caller: AuthCaller,
): Promise<void> {
  try {
    if (caller.superadmin) {
      await membersCol(db).updateOne({ cragId, userId }, { $set: { role } }, { upsert: true });
      return;
    }
    // An existing owner does not match, so the unique index turns that write into a duplicate key.
    await membersCol(db).updateOne(
      { cragId, userId, role: { $ne: 'owner' } },
      { $set: { role } },
      { upsert: true },
    );
  } catch (error) {
    if (!isDuplicateKeyError(error)) {
      console.error('Failed to upsert crag member:', error);
      throw error;
    }
    if (caller.superadmin) {
      const updated = await membersCol(db).updateOne({ cragId, userId }, { $set: { role } });
      if (updated.matchedCount === 0) {
        console.error('Failed to upsert crag member after a duplicate key:', error);
        throw error;
      }
      return;
    }
    const current = await membersCol(db).findOne(
      { cragId, userId },
      { projection: { role: 1 } },
    );
    if (current?.role === role) return;
    throw forbidden();
  }
}

/** Every membership for this caller, ordered by crag id. Any signed-in user may read their own rows. */
export async function listCallerMemberships(
  db: Db,
  caller: AuthCaller,
): Promise<Array<{ cragId: string; role: CragMemberRole }>> {
  const docs = await membersCol(db)
    .find({ userId: caller.uid }, { projection: { _id: 0, cragId: 1, role: 1 } })
    .sort({ cragId: 1 })
    .toArray();
  return docs.flatMap((doc) => (
    doc.role === 'owner' || doc.role === 'admin'
      ? [{ cragId: doc.cragId, role: doc.role }]
      : []
  ));
}

/** Owner or superadmin. Returns `{ userId, role }` for this crag, ordered by user id. */
export async function listMembers(
  db: Db,
  cragId: string,
  caller: AuthCaller,
): Promise<CragMemberResponse[]> {
  await requireMemberManager(db, cragId, caller);
  const docs = await membersCol(db)
    .find({ cragId }, { projection: { _id: 0, userId: 1, role: 1 } })
    .sort({ userId: 1 })
    .toArray();
  return docs.map((doc) => ({ userId: doc.userId, role: doc.role }));
}

/** Upserts one membership. An owner can write `admin` only, and cannot change an owner. */
export async function upsertMember(
  db: Db,
  cragId: string,
  userId: string,
  role: CragMemberRole,
  caller: AuthCaller,
): Promise<CragMemberResponse> {
  await requireMemberManager(db, cragId, caller);
  const existing = await membersCol(db).findOne(
    { cragId, userId },
    { projection: { role: 1 } },
  );
  assertCanSetRole(caller, role, existing?.role);
  await saveMemberRole(db, cragId, userId, role, caller);
  return { userId, role };
}

/** Removes one membership. A missing row is 404. An owner cannot remove an owner. */
export async function deleteMember(
  db: Db,
  cragId: string,
  userId: string,
  caller: AuthCaller,
): Promise<void> {
  await requireMemberManager(db, cragId, caller);
  const existing = await membersCol(db).findOne(
    { cragId, userId },
    { projection: { role: 1 } },
  );
  if (!existing) throw notFound('member');
  assertCanRemove(caller, existing.role);
  const deleted = await membersCol(db).deleteOne({ cragId, userId });
  if (deleted.deletedCount === 0) throw notFound('member');
}
