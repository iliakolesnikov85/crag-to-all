import type { Crag, CragData, DescriptionSection, LatLng, Sector } from '../types';
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

async function readSectorResponse(response: Response): Promise<Sector> {
  const body = (await response.json()) as Partial<Sector>;
  if (
    typeof body.id !== 'string'
    || typeof body.name !== 'string'
    || typeof body.version !== 'number'
    || !body.geo
    || typeof body.geo.lat !== 'number'
    || typeof body.geo.lon !== 'number'
  ) {
    throw new Error('Sector save returned an unexpected response');
  }
  return body as Sector;
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

export interface DescriptionPatchResult {
  description: DescriptionSection[];
  version: number;
}

export async function patchCragDescription(
  cragId: string,
  version: number,
  description: DescriptionSection[],
): Promise<DescriptionPatchResult> {
  const response = await apiFetch(cragDocumentPath(cragId), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ version, description }),
  });
  if (!response.ok) {
    throw new Error(
      await readErrorMessage(response, `Failed to save description (${response.status})`),
    );
  }
  const body = (await response.json()) as { description?: unknown; version?: unknown };
  if (!Array.isArray(body.description) || typeof body.version !== 'number') {
    throw new Error('Description save returned an unexpected response');
  }
  return {
    description: body.description as DescriptionSection[],
    version: body.version,
  };
}

export async function patchSectorGeo(
  cragId: string,
  sectorId: string,
  version: number,
  patch: { name?: string; geo?: LatLng },
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

export async function createSector(
  cragId: string,
  sector: { name: string; geo: LatLng },
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
