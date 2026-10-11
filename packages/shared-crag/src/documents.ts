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
  externalId?: string;
  version: number;
  updatedAt: Date;
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
  routes: Route[];
  images: Image[];
  /** Position in the assembled crag. Extracted sectors use name order; explorer sectors append. */
  order: number;
  externalId?: string;
  version: number;
  updatedAt: Date;
}
