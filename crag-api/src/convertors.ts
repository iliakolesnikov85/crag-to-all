import type { Crag, CragData, Sector } from '@crag-to-all/shared-crag';
import type { CragDocument, CragResponse, SectorDocument, SectorWriteInput } from './types';

export function toCrag(doc: CragDocument): Crag {
  return {
    id: doc._id,
    cragId: doc._id,
    cragName: doc.name,
    source: doc.source,
    ...(doc.externalId ? { externalId: doc.externalId } : {}),
  };
}

export function toCragResponse(doc: CragDocument): CragResponse {
  return {
    id: doc._id,
    cragId: doc._id,
    cragName: doc.name,
    source: doc.source,
    protocolVersion: doc.protocolVersion,
    description: doc.description,
    trails: doc.trails,
    markers: doc.markers,
    ...(doc.opentopoTilePack ? { opentopoTilePack: doc.opentopoTilePack } : {}),
    version: doc.version,
    updatedAt: doc.updatedAt.toISOString(),
    ...(doc.externalId ? { externalId: doc.externalId } : {}),
  };
}

export function toSector(doc: SectorDocument): Sector {
  return {
    id: doc._id,
    name: doc.name,
    geo: doc.geo,
    ...(doc.season !== undefined ? { season: doc.season } : {}),
    ...(doc.approachTime !== undefined ? { approachTime: doc.approachTime } : {}),
    ...(doc.altitude !== undefined ? { altitude: doc.altitude } : {}),
    ...(doc.orientation !== undefined ? { orientation: doc.orientation } : {}),
    ...(doc.timeInSun !== undefined ? { timeInSun: doc.timeInSun } : {}),
    routes: doc.routes,
    images: doc.images,
    version: doc.version,
    updatedAt: doc.updatedAt.toISOString(),
    ...(doc.externalId ? { externalId: doc.externalId } : {}),
  };
}

export function toCragData(crag: CragDocument, sectors: SectorDocument[]): CragData {
  return {
    protocolVersion: crag.protocolVersion,
    name: crag.name,
    sectors: sectors.map(toSector),
    description: crag.description,
    trails: crag.trails,
    markers: crag.markers,
    ...(crag.opentopoTilePack ? { opentopoTilePack: crag.opentopoTilePack } : {}),
    id: crag._id,
    cragId: crag._id,
    source: crag.source,
    version: crag.version,
    updatedAt: crag.updatedAt.toISOString(),
    ...(crag.externalId ? { externalId: crag.externalId } : {}),
  };
}

export function toSectorDocument(
  cragId: string,
  sectorId: string,
  sector: SectorWriteInput,
  version: number,
  updatedAt: Date,
): SectorDocument {
  const doc: SectorDocument = {
    _id: sectorId,
    cragId,
    name: sector.name,
    geo: sector.geo,
    routes: sector.routes,
    images: sector.images,
    version,
    updatedAt,
  };
  if (sector.season !== undefined) doc.season = sector.season;
  if (sector.approachTime !== undefined) doc.approachTime = sector.approachTime;
  if (sector.altitude !== undefined) doc.altitude = sector.altitude;
  if (sector.orientation !== undefined) doc.orientation = sector.orientation;
  if (sector.timeInSun !== undefined) doc.timeInSun = sector.timeInSun;
  if (sector.externalId !== undefined) doc.externalId = sector.externalId;
  return doc;
}
