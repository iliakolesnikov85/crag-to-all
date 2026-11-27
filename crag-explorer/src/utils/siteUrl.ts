/**
 * The public origin of the site. The deploy build sets `VITE_SITE_URL`, so a
 * visit through another host, such as a preview channel, still names the real
 * site. Local runs have none set and use the page's own origin.
 */
export function siteOrigin(): string {
  const configured = String(import.meta.env.VITE_SITE_URL ?? '').trim().replace(/\/+$/, '');
  return configured || window.location.origin;
}
