import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { describe, expect, it, vi } from 'vitest';
import { publishIndexHtml } from './hosting';

const SITE = 'crags-for-all';
const API = 'https://firebasehosting.googleapis.com/v1beta1';
const VERSION = `sites/${SITE}/versions/new`;
const HTML = '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Hi</title></head></html>';

interface Seen {
  method: string;
  url: string;
  json?: unknown;
  raw?: Buffer;
  authorization: string | null;
}

function gzipHash(html: string): { body: Buffer; hash: string } {
  const body = gzipSync(Buffer.from(html, 'utf8'));
  return { body, hash: createHash('sha256').update(body).digest('hex') };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function createFetch(route: (seen: Seen) => Response): { fetchImpl: typeof fetch; seen: Seen[] } {
  const seen: Seen[] = [];
  const fetchImpl: typeof fetch = async (input, init) => {
    const body = init?.body;
    let json: unknown;
    let raw: Buffer | undefined;
    if (typeof body === 'string') json = JSON.parse(body) as unknown;
    else if (body instanceof Uint8Array) raw = Buffer.from(body);
    const headers = new Headers(init?.headers);
    const record: Seen = {
      method: init?.method ?? 'GET',
      url: String(input),
      json,
      raw,
      authorization: headers.get('authorization'),
    };
    seen.push(record);
    return route(record);
  };
  return { fetchImpl, seen };
}

function liveChannel(): Response {
  return jsonResponse({
    name: `sites/${SITE}/channels/live`,
    release: { version: { name: `sites/${SITE}/versions/old` } },
  });
}

describe('publishIndexHtml', () => {
  it('clones the live version, uploads the gzipped index.html, and releases it', async () => {
    const { body, hash } = gzipHash(HTML);
    const wait = vi.fn(async () => {});
    const { fetchImpl, seen } = createFetch((call) => {
      if (call.method === 'GET' && call.url.endsWith('/channels/live')) return liveChannel();
      if (call.method === 'POST' && call.url.endsWith('/versions:clone')) {
        return jsonResponse({ name: 'operations/op1', done: false });
      }
      if (call.method === 'GET' && call.url.endsWith('/operations/op1')) {
        return jsonResponse({ done: true, response: { name: VERSION } });
      }
      if (call.method === 'POST' && call.url.endsWith(':populateFiles')) {
        return jsonResponse({
          uploadRequiredHashes: [hash],
          uploadUrl: `https://upload-firebasehosting.googleapis.com/upload/sites/${SITE}/versions/new/files`,
        });
      }
      if (call.method === 'POST' && call.url.endsWith(`/files/${hash}`)) {
        return new Response(null, { status: 200 });
      }
      if (call.method === 'PATCH' && call.url.includes('updateMask=status')) {
        return jsonResponse({ name: VERSION, status: 'FINALIZED' });
      }
      if (call.method === 'POST' && call.url.includes('/releases?')) {
        return jsonResponse({ name: `sites/${SITE}/channels/live/releases/1` });
      }
      throw new Error(`unexpected ${call.method} ${call.url}`);
    });

    await publishIndexHtml({
      siteId: SITE,
      html: HTML,
      fetchImpl,
      getAccessToken: async () => 'test-token',
      wait,
    });

    expect(wait).not.toHaveBeenCalled();
    expect(seen.every((call) => call.authorization === 'Bearer test-token')).toBe(true);
    expect(seen.map((call) => `${call.method} ${call.url}`)).toEqual([
      `GET ${API}/sites/${SITE}/channels/live`,
      `POST ${API}/sites/${SITE}/versions:clone`,
      `GET ${API}/operations/op1`,
      `POST ${API}/${VERSION}:populateFiles`,
      `POST https://upload-firebasehosting.googleapis.com/upload/sites/${SITE}/versions/new/files/${hash}`,
      `PATCH ${API}/${VERSION}?updateMask=status`,
      `POST ${API}/sites/${SITE}/channels/live/releases?versionName=${encodeURIComponent(VERSION)}`,
    ]);
    expect(seen[1].json).toEqual({
      sourceVersion: `sites/${SITE}/versions/old`,
      finalize: false,
      exclude: { regexes: ['^/index\\.html$'] },
    });
    expect(seen[3].json).toEqual({ files: { '/index.html': hash } });
    expect(seen[4].raw).toEqual(body);
    expect(seen[5].json).toEqual({ status: 'FINALIZED' });
  });

  it('skips the upload when Hosting already has that gzip hash', async () => {
    const { fetchImpl, seen } = createFetch((call) => {
      if (call.url.endsWith('/channels/live')) return liveChannel();
      if (call.url.endsWith('/versions:clone')) {
        return jsonResponse({ done: true, response: { name: VERSION } });
      }
      if (call.url.endsWith(':populateFiles')) {
        return jsonResponse({ uploadRequiredHashes: [], uploadUrl: '' });
      }
      if (call.method === 'PATCH') return jsonResponse({ name: VERSION, status: 'FINALIZED' });
      if (call.url.includes('/releases?')) return jsonResponse({ name: 'releases/1' });
      throw new Error(`unexpected ${call.method} ${call.url}`);
    });

    await publishIndexHtml({
      siteId: SITE,
      html: HTML,
      fetchImpl,
      getAccessToken: async () => 'test-token',
    });

    expect(seen.map((call) => call.method)).toEqual(['GET', 'POST', 'POST', 'PATCH', 'POST']);
    expect(seen.some((call) => call.url.includes('upload-firebasehosting'))).toBe(false);
  });

  it('stops when the live channel has no version', async () => {
    const { fetchImpl } = createFetch(() => jsonResponse({ name: `sites/${SITE}/channels/live` }));
    await expect(publishIndexHtml({
      siteId: SITE,
      html: HTML,
      fetchImpl,
      getAccessToken: async () => 'test-token',
    })).rejects.toThrow('Live channel has no version to clone');
  });
});
