import { randomUUID } from 'node:crypto';
import type { LatLng, Route, Sector } from '@crag-to-all/shared-crag';
import type { Db } from 'mongodb';
import { sectorNameKey, toSector, toSectorDocument } from '../convertors';
import { alreadyExists, isDuplicateKeyError, notFound, readOnly, versionConflict } from '../http';
import type { SectorWriteInput } from '../types';
import { cragsCol, now, sectorsCol } from './collections';

const SECTOR_NAME_TAKEN = 'A sector with this name already exists.';

async function requireWritableCrag(db: Db, cragId: string): Promise<void> {
  const crag = await cragsCol(db).findOne({ _id: cragId });
  if (!crag) throw notFound('crag');
  if (crag.source === 'external') {
    throw readOnly('Sectors on an extracted crag are read-only');
  }
}

async function sectorNameTaken(
  db: Db,
  cragId: string,
  sectorId: string,
  name: string,
): Promise<boolean> {
  const nameKey = sectorNameKey(name);
  const indexed = await sectorsCol(db).findOne(
    { cragId, nameKey, _id: { $ne: sectorId } },
    { projection: { _id: 1 } },
  );
  if (indexed) return true;
  const legacy = await sectorsCol(db)
    .find(
      { cragId, _id: { $ne: sectorId }, nameKey: { $exists: false } },
      { projection: { name: 1 } },
    )
    .toArray();
  return legacy.some((sector) => sectorNameKey(sector.name) === nameKey);
}

async function assertSectorNameAvailable(
  db: Db,
  cragId: string,
  sectorId: string,
  name: string,
): Promise<void> {
  if (await sectorNameTaken(db, cragId, sectorId, name)) {
    throw alreadyExists(SECTOR_NAME_TAKEN);
  }
}

function rethrowSectorWriteError(error: unknown, action: string): never {
  if (isDuplicateKeyError(error)) {
    throw alreadyExists(SECTOR_NAME_TAKEN);
  }
  console.error(`Failed to ${action} sector:`, error);
  throw error;
}

async function nextSectorOrder(db: Db, cragId: string): Promise<number> {
  const latest = await sectorsCol(db).find({ cragId }).sort({ order: -1 }).limit(1).next();
  if (typeof latest?.order !== 'number') return 0;
  return latest.order + 1;
}

export async function addSector(
  db: Db,
  cragId: string,
  sector: SectorWriteInput,
): Promise<Sector> {
  await requireWritableCrag(db, cragId);

  const sectorId = randomUUID();
  await assertSectorNameAvailable(db, cragId, sectorId, sector.name);
  const order = await nextSectorOrder(db, cragId);
  const doc = toSectorDocument(cragId, sectorId, sector, order, 1, now());
  try {
    await sectorsCol(db).insertOne(doc);
  } catch (error) {
    rethrowSectorWriteError(error, 'insert');
  }
  return toSector(doc);
}

export async function replaceSector(
  db: Db,
  cragId: string,
  sectorId: string,
  version: number,
  sector: SectorWriteInput,
): Promise<Sector> {
  await requireWritableCrag(db, cragId);

  const existing = await sectorsCol(db).findOne({ _id: sectorId, cragId });
  if (!existing) throw notFound('sector');
  if (existing.version !== version) {
    throw versionConflict(existing.version);
  }

  const write =
    sector.externalId === undefined && existing.externalId
      ? { ...sector, externalId: existing.externalId }
      : sector;
  await assertSectorNameAvailable(db, cragId, sectorId, write.name);
  const next = toSectorDocument(cragId, sectorId, write, existing.order, existing.version + 1, now());
  let result;
  try {
    result = await sectorsCol(db).replaceOne(
      { _id: sectorId, cragId, version },
      next,
    );
  } catch (error) {
    rethrowSectorWriteError(error, 'replace');
  }
  if (result.matchedCount === 0) {
    const current = await sectorsCol(db).findOne({ _id: sectorId, cragId });
    if (!current) throw notFound('sector');
    throw versionConflict(current.version);
  }
  return toSector(next);
}

export async function patchSectorGeo(
  db: Db,
  cragId: string,
  sectorId: string,
  version: number,
  patch: { geo?: LatLng; name?: string },
): Promise<Sector> {
  await requireWritableCrag(db, cragId);

  const existing = await sectorsCol(db).findOne({ _id: sectorId, cragId });
  if (!existing) throw notFound('sector');
  if (existing.version !== version) {
    throw versionConflict(existing.version);
  }
  if (patch.name !== undefined) {
    await assertSectorNameAvailable(db, cragId, sectorId, patch.name);
  }

  const $set: {
    updatedAt: Date;
    geo?: LatLng;
    name?: string;
    nameKey?: string;
    routes?: Route[];
  } = { updatedAt: now() };
  if (patch.geo !== undefined) $set.geo = patch.geo;
  if (patch.name !== undefined) {
    const name = patch.name;
    $set.name = name;
    $set.nameKey = sectorNameKey(name);
    if (existing.routes?.length) {
      $set.routes = existing.routes.map((route) => ({ ...route, sectorName: name }));
    }
  }

  let updated;
  try {
    updated = await sectorsCol(db).findOneAndUpdate(
      { _id: sectorId, cragId, version },
      { $set, $inc: { version: 1 } },
      { returnDocument: 'after' },
    );
  } catch (error) {
    rethrowSectorWriteError(error, 'update');
  }
  if (!updated) {
    const current = await sectorsCol(db).findOne({ _id: sectorId, cragId });
    if (!current) throw notFound('sector');
    throw versionConflict(current.version);
  }
  return toSector(updated);
}

export async function deleteSector(db: Db, cragId: string, sectorId: string): Promise<void> {
  await requireWritableCrag(db, cragId);

  const result = await sectorsCol(db).deleteOne({ _id: sectorId, cragId });
  if (result.deletedCount === 0) throw notFound('sector');
}
