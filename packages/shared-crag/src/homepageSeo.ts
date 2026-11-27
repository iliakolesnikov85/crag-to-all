import { countryByCode } from './countries';
import {
  DESCRIPTION_MAX,
  SITE_NAME,
  cragDiscipline,
  dominantType,
  trimToWord,
} from './pageSeo';
import { gradeSpanText } from './routeStats';
import type { Crag, CragRouteStats, RouteType } from './types';

const TITLE_NAME_LIMIT = 3;
const GENERIC_HEADING = 'Free climbing guidebooks';
const DESCRIPTION_PREFIX = 'Free climbing guidebooks';
const DESCRIPTION_TAIL = 'Topos, GPS, grades and seasons.';
/** Served from `crag-explorer/public`. */
const IMAGE_PATH = '/header-bg.png';

export interface HomepageSeo {
  title: string;
  description: string;
  /** The page's h1, such as "Climbing in Georgia". */
  heading: string;
  /** Absolute URL of the social preview image. */
  image: string;
  jsonLd: readonly Record<string, unknown>[];
}

function normalizeOrigin(origin: string): string {
  const trimmed = origin.trim().replace(/\/+$/, '');
  return trimmed || 'http://localhost';
}

function isPublicCrag(crag: Crag): boolean {
  return crag.published !== false;
}

/**
 * Title wording from each crag's dominant type. A crag with no dominant
 * type, or any type other than Boulder and Sport, makes it plain "Climbing".
 */
function sitePhrase(types: ReadonlyArray<RouteType | undefined>): string {
  const set = new Set(types);
  const onlyKnown = [...set].every((type) => type === 'Boulder' || type === 'Sport');
  if (set.size === 0 || !onlyKnown) return 'Climbing';
  if (set.size === 2) return 'Bouldering and Sport Climbing';
  return set.has('Boulder') ? 'Bouldering' : 'Sport Climbing';
}

function singleCountry(crags: readonly Crag[]): { code: string; name: string } | undefined {
  if (crags.length === 0) return undefined;
  const code = crags[0].country;
  if (!code) return undefined;
  if (crags.some((crag) => crag.country !== code)) return undefined;
  const country = countryByCode(code);
  if (!country) return undefined;
  return { code: country.code, name: country.name };
}

function buildTitle(
  crags: readonly Crag[],
  phrase: string,
  countryName: string | undefined,
): string {
  if (crags.length === 0) return SITE_NAME;
  const names = crags.slice(0, TITLE_NAME_LIMIT).map((crag) => crag.cragName).join(', ');
  if (countryName) return `Climbing in ${countryName} - Free ${phrase} Guides | ${names}`;
  return `Free ${phrase} Guidebooks | ${names}`;
}

function describeCrag(crag: Crag): string {
  const bits = [cragDiscipline(crag.routeStats)];
  if (crag.country) {
    const country = countryByCode(crag.country);
    if (country) bits.push(country.name);
  }
  if (crag.routeStats) bits.push(`${crag.routeStats.routeCount} routes`);
  return `${crag.cragName} (${bits.join(', ')})`;
}

function describeList(parts: readonly string[], more: boolean): string {
  return `${DESCRIPTION_PREFIX}: ${parts.join(', ')}${more ? ', and more' : ''}. ${DESCRIPTION_TAIL}`;
}

/** Lists as many crags as fit. A single crag too long to fit is cut. */
function buildDescription(crags: readonly Crag[]): string {
  if (crags.length === 0) return `${DESCRIPTION_PREFIX}. ${DESCRIPTION_TAIL}`;
  const parts = crags.map(describeCrag);
  for (let count = parts.length; count >= 1; count -= 1) {
    const text = describeList(parts.slice(0, count), count < parts.length);
    if (text.length <= DESCRIPTION_MAX) return text;
  }
  return trimToWord(describeList(parts.slice(0, 1), false), DESCRIPTION_MAX);
}

function feature(name: string, value: string): Record<string, unknown> {
  return { '@type': 'LocationFeatureSpecification', name, value };
}

function sentenceCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/** One feature per route type, such as "Boulder Grade Range: 6A to 7B". */
function gradeFeatures(stats: CragRouteStats | undefined): Record<string, unknown>[] {
  return (stats?.gradeRanges ?? []).map((range) => feature(
    range.type ? `${range.type} Grade Range` : 'Grade Range',
    gradeSpanText(range),
  ));
}

function attraction(crag: Crag, origin: string): Record<string, unknown> {
  const stats = crag.routeStats;
  const discipline = cragDiscipline(stats);
  const country = crag.country ? countryByCode(crag.country) : undefined;
  const fallback = country
    ? `${crag.cragName} - ${discipline} in ${country.name}.`
    : `${crag.cragName} - ${discipline}.`;
  const amenities = [
    feature('Climbing Type', sentenceCase(discipline)),
    ...gradeFeatures(stats),
  ];
  if (stats?.season) amenities.push(feature('Season', stats.season));
  if (stats?.altitude) amenities.push(feature('Altitude', stats.altitude));

  const item: Record<string, unknown> = {
    '@type': 'TouristAttraction',
    name: crag.cragName,
    description: crag.description?.trim() || fallback,
    url: `${origin}/${encodeURIComponent(crag.id)}/overview`,
    amenityFeature: amenities,
  };
  if (country) {
    item.address = { '@type': 'PostalAddress', addressCountry: country.code };
  }
  if (stats && stats.latitude !== undefined && stats.longitude !== undefined) {
    item.geo = {
      '@type': 'GeoCoordinates',
      latitude: stats.latitude,
      longitude: stats.longitude,
    };
  }
  if (stats) {
    item.additionalProperty = [
      { '@type': 'PropertyValue', name: 'Route Count', value: stats.routeCount },
    ];
  }
  return item;
}

function buildJsonLd(
  crags: readonly Crag[],
  origin: string,
  heading: string,
  description: string,
): Record<string, unknown>[] {
  const website: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE_NAME,
    url: `${origin}/`,
    description,
    inLanguage: 'en',
  };
  if (crags.length === 0) return [website];
  return [
    website,
    {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: heading,
      description,
      url: `${origin}/`,
      numberOfItems: crags.length,
      itemListElement: crags.map((crag, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        item: attraction(crag, origin),
      })),
    },
  ];
}

/** Homepage title, description, heading, and JSON-LD for the published crags. */
export function buildHomepageSeo(crags: readonly Crag[], origin: string): HomepageSeo {
  const published = crags.filter(isPublicCrag);
  const siteOrigin = normalizeOrigin(origin);
  const country = singleCountry(published);
  const phrase = sitePhrase(published.map((crag) => dominantType(crag.routeStats)));
  const heading = country ? `Climbing in ${country.name}` : GENERIC_HEADING;
  const description = buildDescription(published);
  return {
    title: buildTitle(published, phrase, country?.name),
    description,
    heading,
    image: `${siteOrigin}${IMAGE_PATH}`,
    jsonLd: buildJsonLd(published, siteOrigin, heading, description),
  };
}
