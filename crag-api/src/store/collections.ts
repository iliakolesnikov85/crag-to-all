import type { Db } from 'mongodb';
import type { CragDocument, SectorDocument } from '../types';

const CRAGS = 'crags';
const SECTORS = 'sectors';

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
}
