import type {
  CragDocument,
  CragMapMarker,
  CragMapTrail,
  CragSource,
  DescriptionSection,
  LatLng,
  OpenTopoTilePackInfo,
  Route,
  Sector,
  SectorDocument as SharedSectorDocument,
} from '@crag-to-all/shared-crag';

export type { CragDocument } from '@crag-to-all/shared-crag';

export interface SectorDocument extends SharedSectorDocument {
  /** Lowercase name for the per-crag unique index. Omitted on extracted sectors. */
  nameKey?: string;
}

export interface CragCreateInput {
  name: string;
  cragId: string;
}

export type CragPatchInput = Pick<CragDocument, 'version'> &
  Partial<Pick<CragDocument, 'name' | 'description' | 'trails' | 'markers'>> & {
    opentopoTilePack?: OpenTopoTilePackInfo | null;
  };

export type SectorWriteInput = Omit<Sector, 'id' | 'order' | 'version' | 'updatedAt'>;

/** Partial sector update. `null` clears an optional text field. */
export interface SectorPatch {
  geo?: LatLng;
  name?: string;
  season?: string | null;
  approachTime?: string | null;
  altitude?: string | null;
  orientation?: string | null;
  timeInSun?: string | null;
  /** Full replacement of the sector's routes. */
  routes?: Route[];
}

export interface ImageUploadResponse {
  imageFile: string;
  storagePath: string;
}

export interface ImageStorage {
  uploadImage(storagePath: string, data: Buffer): Promise<void>;
}

export interface CragResponse {
  id: string;
  cragId: string;
  cragName: string;
  source: CragSource;
  externalId?: string;
  protocolVersion: number;
  description: DescriptionSection[];
  trails: CragMapTrail[];
  markers: CragMapMarker[];
  opentopoTilePack?: OpenTopoTilePackInfo;
  version: number;
  updatedAt: string;
}
