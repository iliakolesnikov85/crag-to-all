import type { Crag, CragData, Route, Sector, StoredRoute } from '@crag-to-all/shared-crag';
import type { CragDocument, CragResponse, SectorDocument, SectorWriteInput } from './types';

/** Long enough for the homepage line clamp to ellipsize, short enough for the catalog. */
const DESCRIPTION_EXCERPT_MAX = 400;

function plainText(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\s+/g, ' ')
    .replace(/\s+([.,;:!?])/g, '$1')
    .trim();
}

function descriptionExcerpt(sections: CragDocument['description']): string | undefined {
  for (const section of sections) {
    for (const paragraph of section.paragraphs) {
      const text = plainText(paragraph);
      if (text) return text.slice(0, DESCRIPTION_EXCERPT_MAX);
    }
  }
  return undefined;
}

function toPublicRoute(route: StoredRoute): Route {
  const { externalId: _externalId, ...rest } = route;
  return rest;
}

export function toCrag(doc: CragDocument, sectorCount: number): Crag {
  const description = descriptionExcerpt(doc.description);
  return {
    id: doc._id,
    cragName: doc.name,
    source: doc.source,
    sectorCount,
    published: doc.published !== false,
    updatedAt: doc.updatedAt.toISOString(),
    version: doc.version,
    ...(description ? { description } : {}),
  };
}

export function toCragResponse(doc: CragDocument): CragResponse {
  return {
    id: doc._id,
    cragName: doc.name,
    source: doc.source,
    protocolVersion: doc.protocolVersion,
    description: doc.description,
    trails: doc.trails,
    markers: doc.markers,
    published: doc.published !== false,
    ...(doc.opentopoTilePack ? { opentopoTilePack: doc.opentopoTilePack } : {}),
    version: doc.version,
    updatedAt: doc.updatedAt.toISOString(),
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
    routes: doc.routes.map(toPublicRoute),
    images: doc.images,
    version: doc.version,
    updatedAt: doc.updatedAt.toISOString(),
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
    source: crag.source,
    version: crag.version,
    updatedAt: crag.updatedAt.toISOString(),
  };
}

export function sectorNameKey(name: string): string {
  return name.toLowerCase();
}

export function toSectorDocument(
  cragId: string,
  sectorId: string,
  sector: SectorWriteInput,
  order: number,
  version: number,
  updatedAt: Date,
): SectorDocument {
  const doc: SectorDocument = {
    _id: sectorId,
    cragId,
    name: sector.name,
    nameKey: sectorNameKey(sector.name),
    geo: sector.geo,
    routes: sector.routes,
    images: sector.images,
    order,
    version,
    updatedAt,
  };
  if (sector.season !== undefined) doc.season = sector.season;
  if (sector.approachTime !== undefined) doc.approachTime = sector.approachTime;
  if (sector.altitude !== undefined) doc.altitude = sector.altitude;
  if (sector.orientation !== undefined) doc.orientation = sector.orientation;
  if (sector.timeInSun !== undefined) doc.timeInSun = sector.timeInSun;
  return doc;
}
