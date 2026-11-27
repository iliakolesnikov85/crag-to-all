import type { HomepageSeo } from './homepageSeo';
import { SITE_NAME } from './pageSeo';

interface MetaKey {
  attribute: 'name' | 'property';
  key: string;
}

const DESCRIPTION: MetaKey = { attribute: 'name', key: 'description' };
const OG_TITLE: MetaKey = { attribute: 'property', key: 'og:title' };
const OG_DESCRIPTION: MetaKey = { attribute: 'property', key: 'og:description' };

function metaSelector({ attribute, key }: MetaKey): string {
  return `meta[${attribute}="${key}"]`;
}

/**
 * Tags a page change rewrites after the first load. The title tag itself is
 * set through `document.title`. Tags that name the homepage alone, such as
 * `og:image`, stay as written.
 */
export const HEAD_TITLE_SELECTORS: readonly string[] = [metaSelector(OG_TITLE)];
export const HEAD_DESCRIPTION_SELECTORS: readonly string[] = [
  metaSelector(DESCRIPTION),
  metaSelector(OG_DESCRIPTION),
];

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function meta({ attribute, key }: MetaKey, content: string): string {
  return `<meta ${attribute}="${key}" content="${escapeHtml(content)}">`;
}

/**
 * The head tags for the shell page, one string per tag. They leave out the
 * canonical and URL tags: the shell is served for every path, so a fixed URL
 * would name the homepage on all of them. The app sets the canonical itself.
 */
export function renderHomepageHeadTags(seo: HomepageSeo): string[] {
  const tags = [
    `<title>${escapeHtml(seo.title)}</title>`,
    meta(DESCRIPTION, seo.description),
    meta({ attribute: 'property', key: 'og:type' }, 'website'),
    meta(OG_TITLE, seo.title),
    meta(OG_DESCRIPTION, seo.description),
    meta({ attribute: 'property', key: 'og:site_name' }, SITE_NAME),
    meta({ attribute: 'property', key: 'og:locale' }, 'en_US'),
    meta({ attribute: 'property', key: 'og:image' }, seo.image),
    meta({ attribute: 'name', key: 'twitter:card' }, 'summary_large_image'),
  ];
  for (const block of seo.jsonLd) {
    // `<` as an escape keeps a crag name from closing the script early.
    const json = JSON.stringify(block).replace(/</g, '\\u003c');
    tags.push(`<script type="application/ld+json">${json}</script>`);
  }
  return tags;
}
