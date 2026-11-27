import { renderHomepageHeadTags, type HomepageSeo } from '@crag-to-all/shared-crag';

/**
 * The tags this script writes, and the ones earlier versions wrote: a hash
 * comment, canonical and URL tags, and geo tags. A page patched by an older
 * version comes out clean.
 */
const MANAGED_TAG_SOURCES = [
  '<!--\\s*homepage-seo:[a-f0-9]+\\s*-->',
  '<title\\b[^>]*>[\\s\\S]*?<\\/title>',
  '<meta\\b[^>]*(?:name|property)\\s*=\\s*["\'](?:description|og:[^"\']+|twitter:[^"\']+|geo\\.[^"\']+)["\'][^>]*>',
  '<link\\b[^>]*rel\\s*=\\s*["\']canonical["\'][^>]*>',
  '<script\\b[^>]*type\\s*=\\s*["\']application\\/ld\\+json["\'][^>]*>[\\s\\S]*?<\\/script>',
];

/** Drops each managed tag and the linebreak that follows it. */
function stripManagedTags(html: string): string {
  return MANAGED_TAG_SOURCES.reduce((current, source) => {
    return current.replace(new RegExp(`[ \\t]*${source}[ \\t]*\\r?\\n?`, 'gi'), '');
  }, html);
}

/** One tag per line, in the line ending the file already uses. */
function insertAfterCharset(html: string, tags: readonly string[]): string {
  const anchor = /<meta\b[^>]*charset[^>]*>/i.exec(html) ?? /<head\b[^>]*>/i.exec(html);
  if (!anchor) throw new Error('Homepage shell has no head to patch');
  const end = anchor.index + anchor[0].length;
  const lineBreak = html.includes('\r\n') ? '\r\n' : '\n';
  const block = tags.join(`${lineBreak}    `);
  return `${html.slice(0, end)}${lineBreak}    ${block}${html.slice(end)}`;
}

/**
 * Inserts the homepage tags after the charset meta, replacing any older copy.
 * Running it on its own output returns that output, so a caller can compare
 * the result with the live file to see whether anything changed.
 */
export function injectHomepageSeo(html: string, seo: HomepageSeo): string {
  return insertAfterCharset(stripManagedTags(html), renderHomepageHeadTags(seo));
}
