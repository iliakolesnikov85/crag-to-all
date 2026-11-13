import type { Db } from 'mongodb';
import { isDuplicateKeyError } from '../http';
import type { CragDocument, CragMemberDocument, SectorDocument } from '../types';

const CRAGS = 'crags';
const SECTORS = 'sectors';
const CRAG_MEMBERS = 'crag_members';
const DUPLICATE_SECTOR_NAMES =
  'Sector names must be unique within a crag, ignoring case. Resolve duplicate sector names and retry.';

export function cragsCol(db: Db) {
  return db.collection<CragDocument>(CRAGS);
}

export function sectorsCol(db: Db) {
  return db.collection<SectorDocument>(SECTORS);
}

export function membersCol(db: Db) {
  return db.collection<CragMemberDocument>(CRAG_MEMBERS);
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
  await membersCol(db).createIndex({ userId: 1 });
  await membersCol(db).createIndex({ cragId: 1, userId: 1 }, { unique: true });
}
