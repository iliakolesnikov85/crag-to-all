import type { CragMemberRole } from '@crag-to-all/shared-crag';
import type {
  Crag,
  CragData,
  CragMapMarker,
  CragSource,
  DescriptionSection,
  Image,
  LatLng,
  Route,
  Sector,
} from '../types';
import { getAccessToken } from './auth';

const CRAGS_PATH = '/api/crags';

function apiOrigin(): string {
  return (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '');
}

function cragDocumentPath(cragId: string): string {
  return `${CRAGS_PATH}/${encodeURIComponent(cragId)}`;
}

async function readErrorMessage(
  response: Response,
  fallback: string,
  conflictMessage = 'This crag was updated somewhere else. Reload the page and try again.',
): Promise<string> {
  try {
    const body = (await response.json()) as { message?: unknown; error?: unknown };
    if (typeof body.message === 'string' && body.message.trim()) {
      return body.message;
    }
    if (body.error === 'version_conflict') {
      return conflictMessage;
    }
  } catch (error) {
    console.warn('Could not read API error response:', error);
  }
  return fallback;
}

function isSectorGeo(geo: unknown): geo is LatLng | null {
  if (geo === null) return true;
  if (!geo || typeof geo !== 'object') return false;
  const point = geo as Partial<LatLng>;
  return typeof point.lat === 'number' && typeof point.lon === 'number';
}

function isMemberRole(role: unknown): role is CragMemberRole {
  return role === 'owner' || role === 'admin';
}

function readNullableString(value: unknown, failure: string): string | null {
  if (value === null) return null;
  if (typeof value !== 'string') {
    throw new Error(failure);
  }
  return value;
}

function readCragMember(value: unknown): CragMember {
  if (!value || typeof value !== 'object') {
    throw new Error('Crag members returned an unexpected response');
  }
  const row = value as { userId?: unknown; role?: unknown; email?: unknown; name?: unknown };
  if (typeof row.userId !== 'string' || !isMemberRole(row.role)) {
    throw new Error('Crag members returned an unexpected response');
  }
  return {
    userId: row.userId,
    role: row.role,
    email: readNullableString(row.email, 'Crag members returned an unexpected response'),
    name: readNullableString(row.name, 'Crag members returned an unexpected response'),
  };
}

function readVerifiedAccount(value: unknown): VerifiedAccount {
  if (!value || typeof value !== 'object') {
    throw new Error('Account lookup returned an unexpected response');
  }
  const account = value as { uid?: unknown; email?: unknown; name?: unknown };
  if (typeof account.uid !== 'string' || typeof account.email !== 'string') {
    throw new Error('Account lookup returned an unexpected response');
  }
  return {
    uid: account.uid,
    email: account.email,
    name: readNullableString(account.name, 'Account lookup returned an unexpected response'),
  };
}

function isCragMapMarker(value: unknown): value is CragMapMarker {
  if (!value || typeof value !== 'object') return false;
  const marker = value as Partial<CragMapMarker>;
  const geo = marker.geo;
  return typeof marker.type === 'string'
    && typeof marker.info === 'string'
    && geo != null
    && typeof geo.lat === 'number'
    && typeof geo.lon === 'number';
}

async function readSectorResponse(response: Response): Promise<Sector> {
  const body = (await response.json()) as Partial<Sector>;
  if (
    typeof body.id !== 'string'
    || typeof body.name !== 'string'
    || typeof body.version !== 'number'
    || !isSectorGeo(body.geo)
  ) {
    throw new Error('Sector save returned an unexpected response');
  }
  return body as Sector;
}

export interface CragContentPatch {
  description?: DescriptionSection[];
  markers?: readonly CragMapMarker[];
}

export interface CragContentPatchResult {
  description?: DescriptionSection[];
  markers?: CragMapMarker[];
  version: number;
}

export interface CragSettingsPatch {
  name?: string;
  published?: boolean;
}

export interface CragSettingsPatchResult {
  name?: string;
  published?: boolean;
  version: number;
}

export interface CragCreateInput {
  id: string;
  name: string;
  source: CragSource;
  externalId?: string;
}

export interface SectorPatch {
  name?: string;
  geo?: LatLng;
  season?: string | null;
  approachTime?: string | null;
  altitude?: string | null;
  orientation?: string | null;
  timeInSun?: string | null;
  routes?: Route[];
  /**
   * Full replacement of the sector's topo images, in display order.
   * The server drops route image refs for a file that no longer appears here.
   */
  images?: Image[];
}

export interface CreateSectorInput {
  name: string;
  geo: LatLng;
  images?: Array<{ imageFile: string }>;
}

/** Resolve an API path. An empty VITE_API_BASE_URL keeps the path relative so the dev proxy can forward it. */
export function apiUrl(path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${apiOrigin()}${normalized}`;
}

export function getCragsApiUrl(): string {
  return apiUrl(CRAGS_PATH);
}

export function getCragApiUrl(cragId: string): string {
  return apiUrl(cragDocumentPath(cragId));
}

export function getCragGpxUrl(cragId: string): string {
  return apiUrl(`${cragDocumentPath(cragId)}/gpx`);
}

/** Shared fetch. Sends Authorization only when a management token is available. */
export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const token = await getAccessToken();
  const url = apiUrl(path);
  if (!token) {
    return fetch(url, init);
  }
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${token}`);
  return fetch(url, { ...init, headers });
}

export async function listCrags(init?: RequestInit): Promise<Crag[]> {
  const response = await apiFetch(CRAGS_PATH, init);
  if (!response.ok) {
    throw new Error('index fetch failed');
  }
  return response.json() as Promise<Crag[]>;
}

export async function getCrag(cragId: string, init?: RequestInit): Promise<CragData> {
  const response = await apiFetch(cragDocumentPath(cragId), init);
  if (!response.ok) {
    throw new Error(`Failed to fetch crag data (${response.status})`);
  }
  return response.json() as Promise<CragData>;
}

export async function patchCrag(
  cragId: string,
  version: number,
  patch: CragContentPatch,
): Promise<CragContentPatchResult> {
  const response = await apiFetch(cragDocumentPath(cragId), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ version, ...patch }),
  });
  if (!response.ok) {
    throw new Error(
      await readErrorMessage(response, `Failed to save crag (${response.status})`),
    );
  }
  const body = (await response.json()) as {
    description?: unknown;
    markers?: unknown;
    version?: unknown;
  };
  if (typeof body.version !== 'number') {
    throw new Error('Crag save returned an unexpected response');
  }
  const saved: CragContentPatchResult = { version: body.version };
  if (patch.description !== undefined) {
    if (!Array.isArray(body.description)) {
      throw new Error('Crag save returned an unexpected response');
    }
    saved.description = body.description as DescriptionSection[];
  }
  if (patch.markers !== undefined) {
    if (!Array.isArray(body.markers) || !body.markers.every(isCragMapMarker)) {
      throw new Error('Crag save returned an unexpected response');
    }
    saved.markers = body.markers;
  }
  return saved;
}

export async function patchCragSettings(
  cragId: string,
  version: number,
  patch: CragSettingsPatch,
): Promise<CragSettingsPatchResult> {
  const response = await apiFetch(`${cragDocumentPath(cragId)}/settings`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ version, ...patch }),
  });
  if (!response.ok) {
    throw new Error(
      await readErrorMessage(response, `Failed to save crag (${response.status})`),
    );
  }
  const body = (await response.json()) as {
    cragName?: unknown;
    published?: unknown;
    version?: unknown;
  };
  if (typeof body.version !== 'number') {
    throw new Error('Crag save returned an unexpected response');
  }
  const saved: CragSettingsPatchResult = { version: body.version };
  if (patch.name !== undefined) {
    if (typeof body.cragName !== 'string') {
      throw new Error('Crag save returned an unexpected response');
    }
    saved.name = body.cragName;
  }
  if (patch.published !== undefined) {
    if (typeof body.published !== 'boolean') {
      throw new Error('Crag save returned an unexpected response');
    }
    saved.published = body.published;
  }
  return saved;
}

export async function createCrag(input: CragCreateInput): Promise<void> {
  const response = await apiFetch(CRAGS_PATH, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    throw new Error(
      await readErrorMessage(response, `Failed to create crag (${response.status})`),
    );
  }
}

export async function deleteCrag(cragId: string): Promise<void> {
  const response = await apiFetch(cragDocumentPath(cragId), { method: 'DELETE' });
  if (!response.ok) {
    throw new Error(
      await readErrorMessage(response, `Failed to delete crag (${response.status})`),
    );
  }
}

export async function patchSector(
  cragId: string,
  sectorId: string,
  version: number,
  patch: SectorPatch,
): Promise<Sector> {
  const response = await apiFetch(
    `${cragDocumentPath(cragId)}/sectors/${encodeURIComponent(sectorId)}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ version, ...patch }),
    },
  );
  if (!response.ok) {
    throw new Error(
      await readErrorMessage(
        response,
        `Failed to save sector (${response.status})`,
        'This sector was updated somewhere else. Reload the page and try again.',
      ),
    );
  }
  return readSectorResponse(response);
}

export async function uploadCragImage(
  cragId: string,
  file: File,
): Promise<{ imageFile: string }> {
  const body = new FormData();
  body.append('image', file);
  const response = await apiFetch(`${cragDocumentPath(cragId)}/images`, {
    method: 'POST',
    body,
  });
  if (!response.ok) {
    throw new Error(
      await readErrorMessage(response, `Failed to upload image (${response.status})`),
    );
  }
  const uploaded = (await response.json()) as { imageFile?: unknown };
  if (typeof uploaded.imageFile !== 'string' || !uploaded.imageFile.trim()) {
    throw new Error('Image upload returned an unexpected response');
  }
  return { imageFile: uploaded.imageFile };
}

export async function createSector(
  cragId: string,
  sector: CreateSectorInput,
): Promise<Sector> {
  const response = await apiFetch(`${cragDocumentPath(cragId)}/sectors`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(sector),
  });
  if (!response.ok) {
    throw new Error(
      await readErrorMessage(response, `Failed to create sector (${response.status})`),
    );
  }
  return readSectorResponse(response);
}

export interface CragMember {
  userId: string;
  role: CragMemberRole;
  email: string | null;
  name: string | null;
}

export interface VerifiedAccount {
  uid: string;
  email: string;
  name: string | null;
}

export async function listCragMembers(cragId: string): Promise<CragMember[]> {
  const response = await apiFetch(`${cragDocumentPath(cragId)}/members`);
  if (!response.ok) {
    throw new Error(
      await readErrorMessage(response, `Failed to load crag members (${response.status})`),
    );
  }
  const body = (await response.json()) as unknown;
  if (!Array.isArray(body)) {
    throw new Error('Crag members returned an unexpected response');
  }
  return body.map(readCragMember);
}

export async function lookupVerifiedAccount(cragId: string, email: string): Promise<VerifiedAccount> {
  const params = new URLSearchParams({ email: email.trim() });
  const response = await apiFetch(`${cragDocumentPath(cragId)}/accounts?${params.toString()}`);
  if (!response.ok) {
    throw new Error(
      await readErrorMessage(response, `Failed to look up that email (${response.status})`),
    );
  }
  return readVerifiedAccount(await response.json());
}

export async function upsertCragMember(
  cragId: string,
  userId: string,
  role: CragMemberRole,
): Promise<void> {
  const response = await apiFetch(
    `${cragDocumentPath(cragId)}/members/${encodeURIComponent(userId)}`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role }),
    },
  );
  if (!response.ok) {
    throw new Error(
      await readErrorMessage(response, `Failed to save crag member (${response.status})`),
    );
  }
}

export async function deleteCragMember(cragId: string, userId: string): Promise<void> {
  const response = await apiFetch(
    `${cragDocumentPath(cragId)}/members/${encodeURIComponent(userId)}`,
    { method: 'DELETE' },
  );
  if (!response.ok) {
    throw new Error(
      await readErrorMessage(response, `Failed to remove crag member (${response.status})`),
    );
  }
}

export async function deleteSector(cragId: string, sectorId: string): Promise<void> {
  const response = await apiFetch(
    `${cragDocumentPath(cragId)}/sectors/${encodeURIComponent(sectorId)}`,
    { method: 'DELETE' },
  );
  if (!response.ok) {
    throw new Error(
      await readErrorMessage(response, `Failed to delete sector (${response.status})`),
    );
  }
}
