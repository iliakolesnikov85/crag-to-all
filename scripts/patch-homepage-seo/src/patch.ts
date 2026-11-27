import { buildHomepageSeo, type Crag } from '@crag-to-all/shared-crag';
import { injectHomepageSeo } from './injectHtml';

interface PatchHomepageSeoInput {
  siteOrigin: string;
  apiBaseUrl: string;
  fetchImpl?: typeof fetch;
  publish: (html: string) => Promise<void>;
}

interface PatchHomepageSeoResult {
  published: boolean;
}

function originOf(siteOrigin: string): string {
  return siteOrigin.trim().replace(/\/+$/, '');
}

function isCrag(value: unknown): value is Crag {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as { id?: unknown; cragName?: unknown };
  return typeof record.id === 'string' && typeof record.cragName === 'string';
}

async function readOk(response: Response, label: string): Promise<Response> {
  if (!response.ok) throw new Error(`${label} returned ${response.status}`);
  return response;
}

async function loadShell(fetchImpl: typeof fetch, origin: string): Promise<string> {
  const response = await fetchImpl(`${origin}/index.html`, {
    cache: 'no-store',
    redirect: 'manual',
  });
  if (response.status >= 300 && response.status < 400) {
    throw new Error(`Homepage shell redirected (${response.status})`);
  }
  const ok = await readOk(response, 'Homepage shell');
  return ok.text();
}

async function loadCatalog(fetchImpl: typeof fetch, apiBaseUrl: string): Promise<Crag[]> {
  const response = await fetchImpl(`${apiBaseUrl}/api/crags`, { cache: 'no-store' });
  const ok = await readOk(response, 'Crag catalog');
  const payload: unknown = await ok.json();
  if (!Array.isArray(payload)) throw new Error('Crag catalog was not a list');
  return payload.filter(isCrag);
}

/**
 * Rewrites the live index.html when the catalog changes the tags.
 * A patched copy equal to the live file means the page can stay as it is.
 */
export async function patchHomepageSeo(
  input: PatchHomepageSeoInput,
): Promise<PatchHomepageSeoResult> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const origin = originOf(input.siteOrigin);
  const apiBase = input.apiBaseUrl.trim().replace(/\/+$/, '');
  const seo = buildHomepageSeo(await loadCatalog(fetchImpl, apiBase), origin);
  const shell = await loadShell(fetchImpl, origin);
  const html = injectHomepageSeo(shell, seo);
  if (html === shell) return { published: false };
  await input.publish(html);
  return { published: true };
}

export type { PatchHomepageSeoInput, PatchHomepageSeoResult };
