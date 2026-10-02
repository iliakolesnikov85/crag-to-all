export const CRAG_MAP_MARKER_TYPES = [
  'parking_space',
  'water_tap',
  'camping',
  'unknown',
] as const;

export const CRAG_SOURCES = ['external', 'explorer'] as const;

/** Bump when the stored crag JSON shape changes incompatibly. */
export const CRAG_DATA_PROTOCOL = 1;

export type CragMapMarkerType = (typeof CRAG_MAP_MARKER_TYPES)[number];

export type CragSource = (typeof CRAG_SOURCES)[number];

export interface LatLng {
  lat: number;
  lon: number;
}

export interface Sector {
  /** Stable document id. For source=external, defaults to externalId. */
  id?: string;
  /** Thetopo (or other upstream) sector id. */
  externalId?: string;
  name: string;
  geo: LatLng | null;
  season?: string;
  approachTime?: string;
  altitude?: string;
  orientation?: string;
  timeInSun?: string;
  routes: Route[];
  images: Image[];
  version?: number;
  updatedAt?: string;
}

export interface DescriptionSection {
  subheader: string;
  paragraphs: string[];
}

export interface Route {
  id?: string;
  name: string;
  grade: string;
  sectorName: string;
  description: string;
  tags: string[];
  rating?: number;
  ratingVotes?: string;
  images: Array<{ imageFile: string; routeIndex: number }>;
  videos?: Array<{ url: string; addedBy: string }>;
}

export interface LinePoint {
  x: number;
  y: number;
}

export interface Image {
  imageFile: string;
  labelPositions?: any[];
  lines?: Array<Array<LinePoint>>;
}

export interface CragMapTrail {
  name: string;
  color: string;
  points: LatLng[];
}

export interface CragMapMarker {
  type: CragMapMarkerType;
  info: string;
  geo: LatLng;
}

/**
 * Metadata for a crag's OpenTopo raster tile pack.
 * packVersion 2+: single ZIP at `{cragId}/tiles/opentopo/pack.zip`
 * (entries `z/x/y.png`); clients unpack into Cache Storage.
 */
export interface OpenTopoTilePackInfo {
  /** Padded [south, west, north, east]. */
  bbox: [number, number, number, number];
  zoomMin: number;
  zoomMax: number;
  /** Bump when pack layout/policy changes (2 = ZIP; 3 = z10–16 preferred). */
  packVersion: number;
  fetchedAt: number;
  tileCount: number;
  /** Sum of uncompressed tile PNG byte lengths. */
  totalBytes: number;
  /** Size of the ZIP object in Firebase Storage (packVersion >= 2). */
  archiveBytes: number;
}

export interface CragData {
  protocolVersion: number;
  /** Stable document id. For source=external, defaults to externalId. */
  id?: string;
  /** Catalog / URL slug; same as id when both are present. */
  cragId?: string;
  /** Thetopo (or other upstream) crag id. */
  externalId?: string;
  source?: CragSource;
  name: string;
  sectors: Sector[];
  description: DescriptionSection[];
  trails?: CragMapTrail[];
  markers?: CragMapMarker[];
  opentopoTilePack?: OpenTopoTilePackInfo;
  version?: number;
  updatedAt?: string;
}

export interface Crag {
  /** Stable document id. For source=external, defaults to externalId. */
  id?: string;
  cragName: string;
  /** Catalog / URL slug; same as id when both are present. */
  cragId: string;
  /** Thetopo (or other upstream) crag id. */
  externalId?: string;
  source?: CragSource;
}
