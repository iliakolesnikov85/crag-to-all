import type {
  CragDocument,
  CragMapMarker,
  CragMapTrail,
  CragMemberRole,
  CragSource,
  DescriptionSection,
  LatLng,
  OpenTopoTilePackInfo,
  Image,
  Route,
  Sector,
  SectorDocument as SharedSectorDocument,
} from '@crag-to-all/shared-crag';

export type { CragDocument, CragMemberDocument, CragMemberRole } from '@crag-to-all/shared-crag';

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
  /**
   * Full replacement of the sector's topo images, in display order.
   * Route image refs to a file that no longer appears here are removed.
   */
  images?: Image[];
}

export interface ImageUploadResponse {
  imageFile: string;
  storagePath: string;
}

/** One `crag_members` row as returned by the membership routes. */
export interface CragMemberResponse {
  userId: string;
  role: CragMemberRole;
}

export interface ImageStorage {
  uploadImage(storagePath: string, data: Buffer): Promise<void>;
}

/** Identity read from a verified Firebase ID token. */
export interface AuthCaller {
  uid: string;
  /** Trimmed address from the token, or null when the token has none. */
  email: string | null;
  emailVerified: boolean;
  /** True only when the custom claim `superadmin` is the boolean `true`. */
  superadmin: boolean;
}

/** Resolves to the caller when `idToken` is a valid Firebase ID token. Rejects otherwise. */
export interface IdTokenVerifier {
  verifyIdToken(idToken: string): Promise<AuthCaller>;
}

export interface CragResponse {
  id: string;
  cragId: string;
  cragName: string;
  source: CragSource;
  protocolVersion: number;
  description: DescriptionSection[];
  trails: CragMapTrail[];
  markers: CragMapMarker[];
  opentopoTilePack?: OpenTopoTilePackInfo;
  version: number;
  updatedAt: string;
}

declare global {
  namespace Express {
    interface Request {
      /** Set after a verified ID token. Absent on anonymous requests. */
      caller?: AuthCaller;
      /** Set by the crag-write middleware after the caller is allowed to change this crag. */
      writableCrag?: CragDocument;
    }
  }
}
