import { CRAG_DATA_PROTOCOL, type CragData } from '@crag-to-all/shared-crag';
import type { Db, UpdateFilter } from 'mongodb';
import { toCrag, toCragData, toCragResponse } from '../convertors';
import {
  alreadyExists,
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

/** Inserts an empty explorer crag and no `crag_members` row. */
export async function createCrag(db: Db, input: CragCreateInput): Promise<CragResponse> {
  const updatedAt = now();
  const doc: CragDocument = {
    _id: input.cragId,
    name: input.name,
    source: 'explorer',
    protocolVersion: CRAG_DATA_PROTOCOL,
    description: [],
    trails: [],
    markers: [],
    version: 1,
    updatedAt,
  };
  try {
    await cragsCol(db).insertOne(doc);
  } catch (error) {
    if (isDuplicateKeyError(error)) {
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
  const $unset: { opentopoTilePack?: '' } = {};
  if (patch.name !== undefined) $set.name = patch.name;
  if (patch.description !== undefined) $set.description = patch.description;
  if (patch.trails !== undefined) $set.trails = patch.trails;
  if (patch.markers !== undefined) $set.markers = patch.markers;
  if (patch.opentopoTilePack === null) {
    $unset.opentopoTilePack = '';
  } else if (patch.opentopoTilePack !== undefined) {
    $set.opentopoTilePack = patch.opentopoTilePack;
  }

  const update: UpdateFilter<CragDocument> = { $set, $inc: { version: 1 } };
  if ($unset.opentopoTilePack !== undefined) {
    update.$unset = $unset;
  }

  const updated = await cragsCol(db).findOneAndUpdate(
    { _id: cragId, version: patch.version },
    update,
    { returnDocument: 'after' },
  );
  if (!updated) {
    const current = await cragsCol(db).findOne({ _id: cragId });
    if (!current) throw notFound('crag');
    throw versionConflict(current.version);
  }
  return toCragResponse(updated);
}
