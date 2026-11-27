import type {
  CragMapMarker,
  CragMapTrail,
  CragRouteStats,
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
  /**
   * Absent on older documents. Absent or true means the crag is public.
   * New writes always set true or false.
   */
  published?: boolean;
  /**
   * ISO 3166-1 alpha-2 code.
   * Absent on older documents. New creates always set it.
   */
  country?: string;
  opentopoTilePack?: OpenTopoTilePackInfo;
  /** Upstream crag id. A superadmin catalog includes it. Other responses omit it. */
  externalId?: string;
  /**
   * Homepage totals folded from this crag's sectors.
   * Absent until the daily refresh job has saved them.
   */
  routeStats?: CragRouteStats;
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

export type CragMemberRole = 'owner' | 'admin';

/** Mongo `crag_members` document. One row per user on a crag. */
export interface CragMemberDocument {
  cragId: string;
  /** Firebase Auth uid. */
  userId: string;
  role: CragMemberRole;
}
