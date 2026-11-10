export const CRAG_MAP_MARKER_TYPES = [
  'parking_space',
  'water_tap',
  'camping',
  'wc',
  'unknown',
] as const;

export const CRAG_SOURCES = ['external', 'explorer'] as const;

export const ROUTE_TYPES = [
  'Boulder',
  'Sport',
  'Ice or Mixed',
  'DWS',
] as const;

/** Bump when the stored crag JSON shape changes incompatibly. */
export const CRAG_DATA_PROTOCOL = 3;

export type CragMapMarkerType = (typeof CRAG_MAP_MARKER_TYPES)[number];

export type CragSource = (typeof CRAG_SOURCES)[number];

export type RouteType = (typeof ROUTE_TYPES)[number];

export interface LatLng {
  lat: number;
  lon: number;
}

export interface Sector {
  /** Stable document id. */
  id?: string;
  name: string;
  geo: LatLng | null;
  season?: string;
  approachTime?: string;
  altitude?: string;
  orientation?: string;
  timeInSun?: string;
  routes: Route[];
  images: Image[];
  /** Stored sector position. Present on extract payloads; the API does not return it. */
  order?: number;
  version?: number;
  updatedAt?: string;
}

export interface DescriptionSection {
  subheader: string;
  paragraphs: string[];
}

export interface LinePoint {
  x: number;
  y: number;
}

export interface RouteImage {
  imageFile: string;
  /** Display order of this route on the topo. */
  routeIndex: number;
  /** Polyline in image fractions (0–1). y grows downward. */
  line?: LinePoint[];
}

export interface Route {
  /** App-assigned id. Never an upstream route id. */
  id: string;
  name: string;
  grade: string;
  sectorName: string;
  description: string;
  tags: string[];
  type?: RouteType;
  rating?: number;
  ratingVotes?: string;
  /** Length of the climb, in meters. */
  height?: number;
  images: RouteImage[];
  videos?: Array<{ url: string; addedBy: string }>;
}

export interface Image {
  imageFile: string;
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
  /** Stable document id. */
  id?: string;
  /** Catalog / URL slug; same as id when both are present. */
  cragId?: string;
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
  /** Stable document id. */
  id?: string;
  cragName: string;
  /** Catalog / URL slug; same as id when both are present. */
  cragId: string;
  source?: CragSource;
}
