import type { Crag, CragData, DescriptionSection } from '../types';
import { getAccessToken } from './auth';

const CRAGS_PATH = '/api/crags';

function apiOrigin(): string {
  return (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '');
}

function cragDocumentPath(cragId: string): string {
  return `${CRAGS_PATH}/${encodeURIComponent(cragId)}`;
}

async function readErrorMessage(response: Response, fallback: string): Promise<string> {
  try {
    const body = (await response.json()) as { message?: unknown; error?: unknown };
    if (typeof body.message === 'string' && body.message.trim()) {
      return body.message;
    }
    if (body.error === 'version_conflict') {
      return 'This crag was updated somewhere else. Reload the page and try again.';
    }
  } catch (error) {
    console.warn('Could not read API error response:', error);
  }
  return fallback;
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
