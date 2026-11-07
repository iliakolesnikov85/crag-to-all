import type {
  CragMapMarker,
  CragMapTrail,
  CragSource,
  DescriptionSection,
  Image,
  LatLng,
  OpenTopoTilePackInfo,
  Route,
} from './types';

/** Mongo `crags` document. `_id` is the stable crag id (slug). */
export interface CragDocument {
  _id: string;
  name: string;
  source: CragSource;
  protocolVersion: number;
  description: DescriptionSection[];
  trails: CragMapTrail[];
  markers: CragMapMarker[];
  opentopoTilePack?: OpenTopoTilePackInfo;
  /** Upstream crag id. Omitted from API responses. */
  externalId?: string;
  version: number;
  updatedAt: Date;
}

/** Route as stored. `externalId` is the upstream route id and is omitted from API responses. */
export interface StoredRoute extends Route {
  externalId?: string;
}

/** Mongo `sectors` document. `_id` is the stable sector id. */
export interface SectorDocument {
  _id: string;
  cragId: string;
  name: string;
  geo: LatLng | null;
  season?: string;
  approachTime?: string;
  altitude?: string;
  orientation?: string;
  timeInSun?: string;
  routes: StoredRoute[];
  images: Image[];
  /** Position in the assembled crag. Extracted sectors use name order; explorer sectors append. */
  order: number;
  /** Upstream sector id. Omitted from API responses. */
  externalId?: string;
  version: number;
  updatedAt: Date;
}
