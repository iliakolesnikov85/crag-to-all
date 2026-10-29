import type { Db } from 'mongodb';
import { isDuplicateKeyError } from '../http';
import type { CragDocument, SectorDocument } from '../types';

const CRAGS = 'crags';
const SECTORS = 'sectors';
const DUPLICATE_SECTOR_NAMES =
  'Sector names must be unique within a crag, ignoring case. Resolve duplicate sector names and retry.';

export function cragsCol(db: Db) {
  return db.collection<CragDocument>(CRAGS);
}

export function sectorsCol(db: Db) {
  return db.collection<SectorDocument>(SECTORS);
}

export function now(): Date {
  return new Date();
}

export async function ensureIndexes(db: Db): Promise<void> {
  await sectorsCol(db).createIndex({ cragId: 1 });
  try {
    await sectorsCol(db).createIndex(
      { cragId: 1, nameKey: 1 },
      {
        unique: true,
        partialFilterExpression: { nameKey: { $type: 'string' } },
      },
    );
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      console.error('Sector names are not unique within a crag:', error);
      throw new Error(DUPLICATE_SECTOR_NAMES);
    }
    console.error('Failed to create the sector name index:', error);
    throw error;
  }
}
