import { buildHomepageSeo, type Crag } from '@crag-to-all/shared-crag';
import { describe, expect, it, vi } from 'vitest';
import { injectHomepageSeo } from './injectHtml';
import { patchHomepageSeo } from './patch';

const ORIGIN = 'https://crags-for-all.web.app';

const SHELL = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="robots" content="noindex, nofollow" />
    <title>Crag Explorer</title>
    <script type="module" src="/assets/index-abc123.js"></script>
    <link rel="stylesheet" href="/assets/index-abc123.css">
  </head>
  <body><div id="root"></div></body>
</html>`;

const CRAGS = [
  {
    id: 'roshka',
    cragName: 'Roshka',
    published: true,
    country: 'GE',
    routeStats: { routeCount: 8, typeCounts: { Boulder: 8 } },
  },
];

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function fetchShell(shell: string): typeof fetch {
  return async (url) => {
    const href = String(url);
    if (href.endsWith('/api/crags')) return jsonResponse(CRAGS);
    if (href.endsWith('/index.html')) return new Response(shell, { status: 200 });
    throw new Error(`unexpected ${href}`);
  };
}

describe('patchHomepageSeo', () => {
  it('skips the upload when the live page already has the catalog tags', async () => {
    const seo = buildHomepageSeo(CRAGS as Crag[], ORIGIN);
    const publish = vi.fn(async () => {});
    const result = await patchHomepageSeo({
      siteOrigin: `${ORIGIN}/`,
      apiBaseUrl: 'https://api.example/',
      publish,
      fetchImpl: fetchShell(injectHomepageSeo(SHELL, seo)),
    });

    expect(result).toEqual({ published: false });
    expect(publish).not.toHaveBeenCalled();
  });

  it('publishes the patched shell and keeps the bundle links', async () => {
    const seo = buildHomepageSeo(CRAGS as Crag[], ORIGIN);
    const publish = vi.fn<(html: string) => Promise<void>>(async () => {});
    const result = await patchHomepageSeo({
      siteOrigin: ORIGIN,
      apiBaseUrl: 'https://api.example',
      publish,
      fetchImpl: fetchShell(SHELL),
    });

    expect(result).toEqual({ published: true });
    expect(publish).toHaveBeenCalledOnce();
    const html = publish.mock.calls[0][0];
    expect(html).toContain('/assets/index-abc123.js');
    expect(html).toContain('/assets/index-abc123.css');
    expect(html).toContain(`<title>${seo.title}</title>`);
    expect(html).not.toContain('>Crag Explorer</title>');
  });

  it('does not publish a shell with no head', async () => {
    const publish = vi.fn<(html: string) => Promise<void>>(async () => {});
    await expect(patchHomepageSeo({
      siteOrigin: ORIGIN,
      apiBaseUrl: 'https://api.example',
      publish,
      fetchImpl: fetchShell('<html><body>plain</body></html>'),
    })).rejects.toThrow('Homepage shell has no head to patch');
    expect(publish).not.toHaveBeenCalled();
  });

  it('does not publish when the catalog request fails', async () => {
    const publish = vi.fn(async () => {});
    await expect(patchHomepageSeo({
      siteOrigin: ORIGIN,
      apiBaseUrl: 'https://api.example',
      publish,
      fetchImpl: async () => jsonResponse({ error: 'down' }, 500),
    })).rejects.toThrow('Crag catalog returned 500');
    expect(publish).not.toHaveBeenCalled();
  });
});
