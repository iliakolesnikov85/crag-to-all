import { CRAG_DATA_PROTOCOL, type CragData } from '@crag-to-all/shared-crag';
import type { Db, UpdateFilter } from 'mongodb';
import { toCrag, toCragData, toCragResponse } from '../convertors';
import { alreadyExists, isDuplicateKeyError, notFound, versionConflict } from '../http';
import type {
  CragCreateInput,
  CragDocument,
  CragPatchInput,
  CragResponse,
  SectorDocument,
} from '../types';
import { cragsCol, now, sectorsCol } from './collections';

function compareSectorsByOrder(a: SectorDocument, b: SectorDocument): number {
  if (a.order !== b.order) return a.order - b.order;
  return a.name.localeCompare(b.name, undefined, { numeric: true });
}

export async function listCrags(db: Db) {
  const docs = await cragsCol(db).find().sort({ name: 1 }).toArray();
  return docs.map(toCrag);
}

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

export async function assertCragExists(db: Db, cragId: string): Promise<void> {
  const crag = await cragsCol(db).findOne({ _id: cragId }, { projection: { _id: 1 } });
  if (!crag) throw notFound('crag');
}

export async function patchCrag(db: Db, cragId: string, patch: CragPatchInput): Promise<CragResponse> {
  const existing = await cragsCol(db).findOne({ _id: cragId });
  if (!existing) throw notFound('crag');
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
