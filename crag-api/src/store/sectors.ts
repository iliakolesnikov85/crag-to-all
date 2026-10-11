import { randomUUID } from 'node:crypto';
import type { Sector } from '@crag-to-all/shared-crag';
import type { Db } from 'mongodb';
import { toSector, toSectorDocument } from '../convertors';
import { notFound, readOnly, versionConflict } from '../http';
import type { SectorWriteInput } from '../types';
import { cragsCol, now, sectorsCol } from './collections';

async function requireWritableCrag(db: Db, cragId: string): Promise<void> {
  const crag = await cragsCol(db).findOne({ _id: cragId });
  if (!crag) throw notFound('crag');
  if (crag.source === 'external') {
    throw readOnly('Sectors on an extracted crag are read-only');
  }
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
  const order = await nextSectorOrder(db, cragId);
  const doc = toSectorDocument(cragId, sectorId, sector, order, 1, now());
  try {
    await sectorsCol(db).insertOne(doc);
  } catch (error) {
    console.error('Failed to insert sector:', error);
    throw error;
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
  const next = toSectorDocument(cragId, sectorId, write, existing.order, existing.version + 1, now());
  const result = await sectorsCol(db).replaceOne(
    { _id: sectorId, cragId, version },
    next,
  );
  if (result.matchedCount === 0) {
    const current = await sectorsCol(db).findOne({ _id: sectorId, cragId });
    if (!current) throw notFound('sector');
    throw versionConflict(current.version);
  }
  return toSector(next);
}

export async function deleteSector(db: Db, cragId: string, sectorId: string): Promise<void> {
  await requireWritableCrag(db, cragId);

  const result = await sectorsCol(db).deleteOne({ _id: sectorId, cragId });
  if (result.deletedCount === 0) throw notFound('sector');
}
