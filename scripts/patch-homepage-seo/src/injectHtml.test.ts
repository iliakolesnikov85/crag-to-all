import { buildHomepageSeo, type Crag } from '@crag-to-all/shared-crag';
import { describe, expect, it } from 'vitest';
import { injectHomepageSeo } from './injectHtml';

const ORIGIN = 'https://crags-for-all.web.app';

const SHELL = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/icon.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="robots" content="noindex, nofollow" />
    <meta
      name="description"
      content="Crag Explorer - Climbing area information and maps"
    />
    <title>Crag Explorer</title>
    <script type="application/ld+json">{"@type":"Old"}</script>
    <script type="module" crossorigin src="/assets/index-abc123.js"></script>
    <link rel="stylesheet" crossorigin href="/assets/index-abc123.css">
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>`;

/** What the previous version of this script wrote into the live page. */
const LEGACY_BLOCK = [
  `<!-- homepage-seo:${'a'.repeat(64)} -->`,
  '<title>Old title</title>',
  '<meta name="description" content="Old description">',
  '<meta property="og:url" content="https://crags-for-all.web.app/">',
  '<meta property="og:site_name" content="Climbing in Georgia">',
  '<meta name="twitter:url" content="https://crags-for-all.web.app/">',
  '<meta name="twitter:title" content="Old title">',
  '<meta name="geo.region" content="GE">',
  '<meta name="geo.placename" content="Georgia">',
  '<link rel="canonical" href="https://crags-for-all.web.app/">',
  '<script type="application/ld+json">{"@type":"Old"}</script>',
].join('\n    ');

function crag(partial: Pick<Crag, 'id' | 'cragName'> & Partial<Crag>): Crag {
  return { published: true, ...partial };
}

const ROSHKA = crag({
  id: 'roshka',
  cragName: 'Roshka',
  country: 'GE',
  routeStats: { routeCount: 8, typeCounts: { Boulder: 8 } },
});

describe('injectHomepageSeo', () => {
  it('replaces managed tags and leaves the app bundle links', () => {
    const seo = buildHomepageSeo([ROSHKA], ORIGIN);
    const html = injectHomepageSeo(SHELL, seo);

    expect(html).toContain('/assets/index-abc123.js');
    expect(html).toContain('/assets/index-abc123.css');
    expect(html).toContain('name="robots" content="noindex, nofollow"');
    expect(html).not.toContain('Crag Explorer - Climbing area information');
    expect(html).not.toContain('"Old"');
    expect(html).toContain(`<title>${seo.title}</title>`);
    expect(html).toContain(`<meta property="og:image" content="${seo.image}">`);
    expect(html.match(/<title>/g)).toHaveLength(1);
    expect(html.match(/application\/ld\+json/g)).toHaveLength(seo.jsonLd.length);
  });

  it('writes no tag that names one URL for every path', () => {
    const html = injectHomepageSeo(SHELL, buildHomepageSeo([ROSHKA], ORIGIN));

    expect(html).not.toContain('rel="canonical"');
    expect(html).not.toContain('og:url');
    expect(html).not.toContain('twitter:url');
  });

  it('returns its own output unchanged when run again', () => {
    const seo = buildHomepageSeo([ROSHKA], ORIGIN);
    const once = injectHomepageSeo(SHELL, seo);

    expect(injectHomepageSeo(once, seo)).toBe(once);
  });

  it('returns its own output unchanged for a file with Windows line endings', () => {
    const seo = buildHomepageSeo([ROSHKA], ORIGIN);
    const crlfShell = SHELL.replace(/\n/g, '\r\n');
    const once = injectHomepageSeo(crlfShell, seo);

    expect(injectHomepageSeo(once, seo)).toBe(once);
    expect(once).not.toMatch(/(?<!\r)\n/);
  });

  it('changes the page when the catalog changes', () => {
    const once = injectHomepageSeo(SHELL, buildHomepageSeo([ROSHKA], ORIGIN));
    const next = injectHomepageSeo(once, buildHomepageSeo([
      ROSHKA,
      crag({ id: 'font', cragName: 'Font', country: 'FR' }),
    ], ORIGIN));

    expect(next).not.toBe(once);
    expect(next).toContain('Font');
    expect(next.match(/<title>/g)).toHaveLength(1);
    expect(next).toContain('/assets/index-abc123.js');
  });

  it('removes every tag a page patched by the previous version carries', () => {
    const legacy = SHELL.replace(
      '<meta charset="UTF-8" />',
      `<meta charset="UTF-8" />\n    ${LEGACY_BLOCK}`,
    );
    const html = injectHomepageSeo(legacy, buildHomepageSeo([ROSHKA], ORIGIN));

    expect(html).not.toContain('homepage-seo:');
    expect(html).not.toContain('Old title');
    expect(html).not.toContain('geo.');
    expect(html).not.toContain('rel="canonical"');
    expect(html).not.toContain('twitter:url');
    expect(html).not.toContain('og:site_name" content="Climbing in Georgia"');
    expect(html).toContain('<meta property="og:site_name" content="Crag Explorer">');
    expect(html.match(/og:site_name/g)).toHaveLength(1);
    expect(html.match(/<title>/g)).toHaveLength(1);
  });

  it('throws when the page has no head to patch', () => {
    expect(() => injectHomepageSeo('<html><body>plain</body></html>', buildHomepageSeo([], ORIGIN)))
      .toThrow('Homepage shell has no head to patch');
  });
});
