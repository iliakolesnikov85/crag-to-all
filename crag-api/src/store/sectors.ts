import { randomUUID } from 'node:crypto';
import type { Sector } from '@crag-to-all/shared-crag';
import type { Db } from 'mongodb';
import { toSector, toSectorDocument } from '../convertors';
import { notFound, versionConflict } from '../http';
import type { SectorWriteInput } from '../types';
import { cragsCol, now, sectorsCol } from './collections';

export async function addSector(
  db: Db,
  cragId: string,
  sector: SectorWriteInput,
): Promise<Sector> {
  const crag = await cragsCol(db).findOne({ _id: cragId });
  if (!crag) throw notFound('crag');

  const sectorId = randomUUID();
  const doc = toSectorDocument(cragId, sectorId, sector, 1, now());
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
  const existing = await sectorsCol(db).findOne({ _id: sectorId, cragId });
  if (!existing) throw notFound('sector');
  if (existing.version !== version) {
    throw versionConflict(existing.version);
  }

  const write =
    sector.externalId === undefined && existing.externalId
      ? { ...sector, externalId: existing.externalId }
      : sector;
  const next = toSectorDocument(cragId, sectorId, write, existing.version + 1, now());
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
  const crag = await cragsCol(db).findOne({ _id: cragId });
  if (!crag) throw notFound('crag');

  const result = await sectorsCol(db).deleteOne({ _id: sectorId, cragId });
  if (result.deletedCount === 0) throw notFound('sector');
}
