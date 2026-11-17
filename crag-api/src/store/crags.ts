import { CRAG_DATA_PROTOCOL, type CragData } from '@crag-to-all/shared-crag';
import type { Db } from '@crag-to-all/shared-firebase';
import { toCrag, toCragData, toCragResponse } from '../convertors';
import {
  alreadyExists,
  conflict,
  forbidden,
  isDuplicateKeyError,
  notFound,
  readOnly,
  versionConflict,
} from '../http';
import type {
  AuthCaller,
  CragCreateInput,
  CragDocument,
  CragPatchInput,
  CragResponse,
  SectorDocument,
} from '../types';
import { cragsCol, membersCol, now, sectorsCol } from './collections';

function compareSectorsByOrder(a: SectorDocument, b: SectorDocument): number {
  if (a.order !== b.order) return a.order - b.order;
  return a.name.localeCompare(b.name, undefined, { numeric: true });
}

function duplicateKeyField(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null || !('keyPattern' in error)) return undefined;
  const pattern = (error as { keyPattern?: unknown }).keyPattern;
  if (typeof pattern !== 'object' || pattern === null) return undefined;
  return Object.keys(pattern)[0];
}

async function hasWriteMembership(db: Db, cragId: string, userId: string): Promise<boolean> {
  const member = await membersCol(db).findOne(
    { cragId, userId },
    { projection: { role: 1 } },
  );
  return member?.role === 'owner' || member?.role === 'admin';
}

export async function listCrags(db: Db) {
  const docs = await cragsCol(db).find().sort({ name: 1 }).toArray();
  return docs.map(toCrag);
}

/** Inserts an empty crag and no `crag_members` row. */
export async function createCrag(db: Db, input: CragCreateInput): Promise<CragResponse> {
  const updatedAt = now();
  const doc: CragDocument = {
    _id: input.cragId,
    name: input.name,
    source: input.source,
    protocolVersion: CRAG_DATA_PROTOCOL,
    description: [],
    trails: [],
    markers: [],
    version: 1,
    updatedAt,
  };
  if (input.externalId !== undefined) doc.externalId = input.externalId;
  try {
    await cragsCol(db).insertOne(doc);
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      if (duplicateKeyField(error) === 'externalId') {
        throw alreadyExists(`A crag with externalId "${input.externalId}" already exists`);
      }
      throw alreadyExists(`Crag "${input.cragId}" already exists`);
    }
    console.error('Failed to insert crag:', error);
    throw error;
  }
  return toCragResponse(doc);
}

export async function getAssembledCrag(db: Db, cragId: string): Promise<CragData> {
  const crag = await cragsCol(db).findOne({ _id: cragId });
  if (!crag) throw notFound('crag');
  const sectors = await sectorsCol(db).find({ cragId }).toArray();
  sectors.sort(compareSectorsByOrder);
  return toCragData(crag, sectors);
}

/**
 * The crag exists and this caller may change it.
 * Extracted crags stay read-only for every role, including a superadmin.
 * An explorer crag allows a superadmin, or a `crag_members` owner or admin.
 */
export async function requireWritableCrag(
  db: Db,
  cragId: string,
  caller: AuthCaller,
): Promise<CragDocument> {
  const crag = await cragsCol(db).findOne({ _id: cragId });
  if (!crag) throw notFound('crag');
  if (crag.source === 'external') {
    throw readOnly('An extracted crag is read-only');
  }
  if (caller.superadmin || (await hasWriteMembership(db, cragId, caller.uid))) {
    return crag;
  }
  throw forbidden();
}

export async function patchCrag(
  db: Db,
  existing: CragDocument,
  patch: CragPatchInput,
): Promise<CragResponse> {
  const cragId = existing._id;
  if (existing.version !== patch.version) {
    throw versionConflict(existing.version);
  }

  const $set: Omit<Partial<CragDocument>, '_id'> = { updatedAt: now() };
  if (patch.name !== undefined) $set.name = patch.name;
  if (patch.description !== undefined) $set.description = patch.description;
  if (patch.trails !== undefined) $set.trails = patch.trails;
  if (patch.markers !== undefined) $set.markers = patch.markers;

  const updated = await cragsCol(db).findOneAndUpdate(
    { _id: cragId, version: patch.version },
    { $set, $inc: { version: 1 } },
    { returnDocument: 'after' },
  );
  if (!updated) {
    const current = await cragsCol(db).findOne({ _id: cragId });
    if (!current) throw notFound('crag');
    throw versionConflict(current.version);
  }
  return toCragResponse(updated);
}

/**
 * Deletes a crag that has no sectors, and its membership rows.
 * The check and both deletes commit together, so a failed member delete
 * cannot leave owners behind for a later crag with the same id.
 */
export async function deleteCrag(db: Db, cragId: string): Promise<void> {
  const session = db.client.startSession();
  try {
    await session.withTransaction(async () => {
      const crag = await cragsCol(db).findOne(
        { _id: cragId },
        { projection: { _id: 1 }, session },
      );
      if (!crag) throw notFound('crag');
      const sectorCount = await sectorsCol(db).countDocuments({ cragId }, { session });
      if (sectorCount > 0) {
        throw conflict('Crag still has sectors');
      }
      const deleted = await cragsCol(db).deleteOne({ _id: cragId }, { session });
      if (deleted.deletedCount !== 1) throw notFound('crag');
      await membersCol(db).deleteMany({ cragId }, { session });
    });
  } finally {
    try {
      await session.endSession();
    } catch (error) {
      console.error('Failed to end the MongoDB session after deleting a crag:', error);
    }
  }
}
