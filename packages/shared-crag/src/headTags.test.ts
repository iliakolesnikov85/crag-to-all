import { describe, expect, it } from 'vitest';
import {
  HEAD_DESCRIPTION_SELECTORS,
  HEAD_TITLE_SELECTORS,
  renderHomepageHeadTags,
} from './headTags';
import type { HomepageSeo } from './homepageSeo';

const seo: HomepageSeo = {
  title: 'Free Bouldering Guidebooks | Roshka & "Cave"',
  description: 'Free climbing guidebooks: Roshka <b>',
  heading: 'Climbing in Georgia',
  image: 'https://crags-for-all.web.app/header-bg.png',
  jsonLd: [{ '@type': 'WebSite', name: 'Crag Explorer </script>' }],
};

describe('renderHomepageHeadTags', () => {
  const html = renderHomepageHeadTags(seo).join('\n');

  it('writes the title, description, and preview tags with a fixed site name', () => {
    expect(html).toContain('<title>Free Bouldering Guidebooks | Roshka &amp; &quot;Cave&quot;</title>');
    expect(html).toContain('<meta name="description" content="Free climbing guidebooks: Roshka &lt;b&gt;">');
    expect(html).toContain('<meta property="og:image" content="https://crags-for-all.web.app/header-bg.png">');
    expect(html).toContain('<meta property="og:site_name" content="Crag Explorer">');
    expect(html).toContain('<meta name="twitter:card" content="summary_large_image">');
  });

  it('leaves out every tag that would name one URL for all paths', () => {
    expect(html).not.toContain('rel="canonical"');
    expect(html).not.toContain('og:url');
    expect(html).not.toContain('twitter:url');
  });

  it('keeps a closing script tag in the data from ending the JSON-LD block', () => {
    const blocks = html.match(/<script type="application\/ld\+json">/g) ?? [];
    expect(blocks).toHaveLength(1);
    expect(html).toContain('Crag Explorer \\u003c/script>');
    expect(html.match(/<\/script>/g)).toHaveLength(1);
  });

  it('writes a tag for every selector the app rewrites', () => {
    for (const selector of [...HEAD_TITLE_SELECTORS, ...HEAD_DESCRIPTION_SELECTORS]) {
      const [, attribute, key] = /^meta\[(\w+)="([^"]+)"\]$/.exec(selector) ?? [];
      expect(html).toContain(`<meta ${attribute}="${key}"`);
    }
  });
});
