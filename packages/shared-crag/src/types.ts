export interface Sector {
  name: string;
  geo: string | null;
  season?: string;
  approachTime?: string;
  altitude?: string;
  orientation?: string;
  timeInSun?: string;
  routes: Route[];
  images: Image[];
}

export interface DescriptionSection {
  subheader: string;
  paragraphs: string[];
}

export interface Route {
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
  points: string;
}

export interface CragMapMarker {
  type: string;
  info: string;
  latitude: string;
  longitude: string;
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
  name: string;
  sectors: Sector[];
  description: DescriptionSection[];
  trails?: CragMapTrail[];
  markers?: CragMapMarker[];
  opentopoTilePack?: OpenTopoTilePackInfo;
}

export interface Crag {
  cragName: string;
  cragId: string;
}
