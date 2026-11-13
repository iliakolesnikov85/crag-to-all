import { randomUUID } from 'node:crypto';
import type { Image, LatLng, Sector, StoredRoute } from '@crag-to-all/shared-crag';
import type { Db } from 'mongodb';
import { sectorNameKey, toSector, toSectorDocument } from '../convertors';
import { alreadyExists, isDuplicateKeyError, notFound, versionConflict } from '../http';
import type { SectorDocument, SectorPatch, SectorWriteInput } from '../types';
import { now, sectorsCol } from './collections';

const SECTOR_NAME_TAKEN = 'A sector with this name already exists.';
const DETAIL_FIELDS = ['season', 'approachTime', 'altitude', 'orientation', 'timeInSun'] as const;

type DetailField = (typeof DETAIL_FIELDS)[number];

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

function detailUpdates(patch: SectorPatch): {
  fields: Partial<Pick<SectorDocument, DetailField>>;
  cleared: Partial<Record<DetailField, ''>>;
} {
  const fields: Partial<Pick<SectorDocument, DetailField>> = {};
  const cleared: Partial<Record<DetailField, ''>> = {};
  for (const field of DETAIL_FIELDS) {
    const value = patch[field];
    if (value === undefined) continue;
    if (value === null) cleared[field] = '';
    else fields[field] = value;
  }
  return { fields, cleared };
}

function mergeRouteExternalIds(
  incoming: readonly StoredRoute[],
  existing: readonly StoredRoute[],
): StoredRoute[] {
  const externalByKey = new Map<string, string>();
  for (const route of existing) {
    if (!route.externalId || !route.id) continue;
    externalByKey.set(route.id, route.externalId);
  }
  return incoming.map((route) => {
    const externalId = externalByKey.get(route.id);
    if (!externalId || route.externalId) return route;
    return { ...route, externalId };
  });
}

/** Drop route image refs whose file is absent from `images`. Other route fields stay as stored. */
function routesAfterImagePatch(
  routes: readonly StoredRoute[],
  images: readonly Image[],
): StoredRoute[] | undefined {
  const remaining = new Set(images.map((image) => image.imageFile));
  let changed = false;
  const next = routes.map((route) => {
    const refs = route.images ?? [];
    const kept = refs.filter((ref) => remaining.has(ref.imageFile));
    if (kept.length === refs.length) return route;
    changed = true;
    return { ...route, images: kept };
  });
  return changed ? next : undefined;
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
  const existing = await sectorsCol(db).findOne({ _id: sectorId, cragId });
  if (!existing) throw notFound('sector');
  if (existing.version !== version) {
    throw versionConflict(existing.version);
  }

  await assertSectorNameAvailable(db, cragId, sectorId, sector.name);
  const next = toSectorDocument(cragId, sectorId, sector, existing.order, existing.version + 1, now());
  if (existing.externalId) next.externalId = existing.externalId;
  next.routes = mergeRouteExternalIds(next.routes, existing.routes);
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

export async function patchSector(
  db: Db,
  cragId: string,
  sectorId: string,
  version: number,
  patch: SectorPatch,
): Promise<Sector> {
  const existing = await sectorsCol(db).findOne({ _id: sectorId, cragId });
  if (!existing) throw notFound('sector');
  if (existing.version !== version) {
    throw versionConflict(existing.version);
  }
  if (patch.name !== undefined) {
    await assertSectorNameAvailable(db, cragId, sectorId, patch.name);
  }

  const details = detailUpdates(patch);
  const $set: {
    updatedAt: Date;
    geo?: LatLng;
    name?: string;
    nameKey?: string;
    routes?: StoredRoute[];
    images?: Image[];
    season?: string;
    approachTime?: string;
    altitude?: string;
    orientation?: string;
    timeInSun?: string;
  } = { updatedAt: now(), ...details.fields };
  if (patch.geo !== undefined) $set.geo = patch.geo;
  if (patch.name !== undefined) {
    $set.name = patch.name;
    $set.nameKey = sectorNameKey(patch.name);
  }
  const sectorName = patch.name ?? existing.name;
  if (patch.routes !== undefined) {
    $set.routes = mergeRouteExternalIds(
      patch.routes.map((route) => ({
        ...route,
        id: route.id || randomUUID(),
        sectorName,
      })),
      existing.routes,
    );
  } else if (patch.name !== undefined && existing.routes?.length) {
    $set.routes = existing.routes.map((route) => ({ ...route, sectorName }));
  }
  if (patch.images !== undefined) {
    $set.images = patch.images;
    // An explicit routes patch is the source of truth. Otherwise unlink files
    // that this image list no longer contains, without revalidating the routes.
    if (patch.routes === undefined) {
      const unlinked = routesAfterImagePatch($set.routes ?? existing.routes ?? [], patch.images);
      if (unlinked) $set.routes = unlinked;
    }
  }

  const update: {
    $set: typeof $set;
    $inc: { version: number };
    $unset?: typeof details.cleared;
  } = { $set, $inc: { version: 1 } };
  if (Object.keys(details.cleared).length > 0) update.$unset = details.cleared;

  let updated;
  try {
    updated = await sectorsCol(db).findOneAndUpdate(
      { _id: sectorId, cragId, version },
      update,
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
  const result = await sectorsCol(db).deleteOne({ _id: sectorId, cragId });
  if (result.deletedCount === 0) throw notFound('sector');
}
