import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';

const HOSTING_API = 'https://firebasehosting.googleapis.com/v1beta1';
const INDEX_PATH = '/index.html';
const INDEX_EXCLUDE = '^/index\\.html$';
const CLONE_POLLS = 30;
const CLONE_POLL_MS = 1000;

interface PublishIndexHtmlInput {
  siteId: string;
  html: string;
  fetchImpl?: typeof fetch;
  getAccessToken: () => Promise<string>;
  wait?: (ms: number) => Promise<void>;
}

interface HostingCall {
  siteId: string;
  fetchImpl: typeof fetch;
  getAccessToken: () => Promise<string>;
  wait: (ms: number) => Promise<void>;
}

interface OperationBody {
  done: boolean;
  name?: string;
  response?: unknown;
  errorMessage?: string;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function gzipHash(html: string): { body: Uint8Array<ArrayBuffer>; hash: string } {
  const gzipped = gzipSync(Buffer.from(html, 'utf8'));
  const body = new Uint8Array(gzipped.byteLength);
  body.set(gzipped);
  const hash = createHash('sha256').update(body).digest('hex');
  return { body, hash };
}

function operationUrl(name: string): string {
  if (name.startsWith('https://')) return name;
  return `${HOSTING_API}/${name.replace(/^\/+/, '')}`;
}

function asOperation(body: unknown): OperationBody {
  if (!isRecord(body)) return { done: false };
  const error = isRecord(body.error) && typeof body.error.message === 'string'
    ? body.error.message
    : undefined;
  return {
    done: body.done === true,
    name: typeof body.name === 'string' ? body.name : undefined,
    response: body.response,
    errorMessage: error,
  };
}

function liveVersionName(body: unknown): string {
  if (!isRecord(body) || !isRecord(body.release) || !isRecord(body.release.version)) {
    throw new Error('Live channel has no version to clone');
  }
  const name = body.release.version.name;
  if (typeof name !== 'string' || name.length === 0) {
    throw new Error('Live channel has no version to clone');
  }
  return name;
}

function versionFromOperation(operation: OperationBody): string {
  if (operation.errorMessage) {
    throw new Error(`Hosting clone failed: ${operation.errorMessage}`);
  }
  if (
    !isRecord(operation.response)
    || typeof operation.response.name !== 'string'
    || !operation.response.name.includes('/versions/')
  ) {
    throw new Error('Hosting clone finished without a version name');
  }
  return operation.response.name;
}

function uploadPlan(body: unknown): { hashes: string[]; uploadUrl: string } {
  if (!isRecord(body)) throw new Error('populateFiles returned an empty body');
  const hashes = Array.isArray(body.uploadRequiredHashes)
    ? body.uploadRequiredHashes.filter((item): item is string => typeof item === 'string')
    : [];
  if (hashes.length === 0) return { hashes, uploadUrl: '' };
  if (typeof body.uploadUrl !== 'string' || body.uploadUrl.length === 0) {
    throw new Error('populateFiles did not return an upload URL');
  }
  return { hashes, uploadUrl: body.uploadUrl.replace(/\/+$/, '') };
}

async function readJson(response: Response, label: string): Promise<unknown> {
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`${label} returned ${response.status}: ${text.slice(0, 500)}`);
  }
  if (!text) return undefined;
  try {
    return JSON.parse(text) as unknown;
  } catch (error) {
    console.error(`${label} returned invalid JSON:`, error);
    throw new Error(`${label} returned invalid JSON`);
  }
}

async function hostingRequest(
  call: HostingCall,
  method: string,
  url: string,
  body?: string | Uint8Array<ArrayBuffer>,
  contentType?: string,
): Promise<Response> {
  const token = await call.getAccessToken();
  const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
  if (contentType) headers['Content-Type'] = contentType;
  return call.fetchImpl(url, { method, headers, body });
}

async function requestJson(
  call: HostingCall,
  method: string,
  url: string,
  label: string,
  body?: unknown,
): Promise<unknown> {
  const response = await hostingRequest(
    call,
    method,
    url,
    body === undefined ? undefined : JSON.stringify(body),
    body === undefined ? undefined : 'application/json',
  );
  return readJson(response, label);
}

async function clonedVersion(call: HostingCall, sourceVersion: string): Promise<string> {
  let operation = asOperation(await requestJson(
    call,
    'POST',
    `${HOSTING_API}/sites/${call.siteId}/versions:clone`,
    'Hosting clone',
    {
      sourceVersion,
      finalize: false,
      exclude: { regexes: [INDEX_EXCLUDE] },
    },
  ));
  for (let attempt = 0; attempt < CLONE_POLLS; attempt += 1) {
    if (operation.done) return versionFromOperation(operation);
    if (!operation.name) throw new Error('Hosting clone did not return an operation name');
    if (attempt > 0) await call.wait(CLONE_POLL_MS);
    operation = asOperation(await requestJson(
      call,
      'GET',
      operationUrl(operation.name),
      'Hosting clone',
    ));
  }
  if (operation.done) return versionFromOperation(operation);
  throw new Error('Hosting clone did not finish');
}

/** Uploads index.html onto a clone of the live version and releases that clone. */
export async function publishIndexHtml(input: PublishIndexHtmlInput): Promise<void> {
  const call: HostingCall = {
    siteId: input.siteId,
    fetchImpl: input.fetchImpl ?? fetch,
    getAccessToken: input.getAccessToken,
    wait: input.wait ?? delay,
  };
  const channel = await requestJson(
    call,
    'GET',
    `${HOSTING_API}/sites/${call.siteId}/channels/live`,
    'Live channel',
  );
  const versionName = await clonedVersion(call, liveVersionName(channel));
  const gzipped = gzipHash(input.html);
  const populated = uploadPlan(await requestJson(
    call,
    'POST',
    `${HOSTING_API}/${versionName}:populateFiles`,
    'populateFiles',
    { files: { [INDEX_PATH]: gzipped.hash } },
  ));
  if (populated.hashes.length > 0 && !populated.hashes.includes(gzipped.hash)) {
    throw new Error(`Hosting asked for an unexpected file hash: ${populated.hashes.join(', ')}`);
  }
  if (populated.hashes.includes(gzipped.hash)) {
    const upload = await hostingRequest(
      call,
      'POST',
      `${populated.uploadUrl}/${gzipped.hash}`,
      gzipped.body,
      'application/octet-stream',
    );
    if (!upload.ok) {
      const detail = await upload.text();
      throw new Error(`File upload returned ${upload.status}: ${detail.slice(0, 500)}`);
    }
  }
  await requestJson(
    call,
    'PATCH',
    `${HOSTING_API}/${versionName}?updateMask=status`,
    'Finalize version',
    { status: 'FINALIZED' },
  );
  await requestJson(
    call,
    'POST',
    `${HOSTING_API}/sites/${call.siteId}/channels/live/releases?versionName=${encodeURIComponent(versionName)}`,
    'Hosting release',
    {},
  );
}

export type { PublishIndexHtmlInput };
