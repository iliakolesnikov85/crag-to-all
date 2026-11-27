import { countryByCode } from './countries';
import { foldRouteStats, gradeSpanText } from './routeStats';
import {
  ROUTE_TYPES,
  type Crag,
  type CragRouteStats,
  type Route,
  type RouteType,
  type Sector,
} from './types';

/** The site's own name. No page or catalog changes it. */
export const SITE_NAME = 'Crag Explorer';

/** Search results cut a meta description at about this length. */
export const DESCRIPTION_MAX = 160;

const DOMINANT_SHARE = 0.8;

export interface PageSeoText {
  title: string;
  description: string;
}

type NounKey = RouteType | 'none';

const ROUTE_NOUNS: Record<NounKey, { one: string; many: string }> = {
  Boulder: { one: 'boulder problem', many: 'boulder problems' },
  Sport: { one: 'sport route', many: 'sport routes' },
  'Ice or Mixed': { one: 'ice or mixed route', many: 'ice or mixed routes' },
  DWS: { one: 'deep-water solo', many: 'deep-water solos' },
  none: { one: 'route', many: 'routes' },
};

const DISCIPLINE_BY_TYPE: Record<RouteType, string> = {
  Boulder: 'bouldering',
  Sport: 'sport climbing',
  'Ice or Mixed': 'ice and mixed climbing',
  DWS: 'deep-water soloing',
};

/** Joins the sentences that have text, with single spaces. */
function sentences(...parts: ReadonlyArray<string | undefined>): string {
  return parts.filter((part): part is string => Boolean(part)).join(' ');
}

/** Cuts at a word boundary and ends with a full stop. The result fits `max`. */
export function trimToWord(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  const space = cut.lastIndexOf(' ');
  const base = (space > 40 ? cut.slice(0, space) : cut).replace(/[,\s.]+$/, '');
  return `${base}.`;
}

function description(...parts: ReadonlyArray<string | undefined>): string {
  return trimToWord(sentences(...parts), DESCRIPTION_MAX);
}

function countNoun(n: number, type: NounKey): string {
  const noun = ROUTE_NOUNS[type];
  return `${n} ${n === 1 ? noun.one : noun.many}`;
}

/** "12 boulder problems and 3 sport routes", with untyped routes as "other". */
function routeCountText(total: number, typeCounts: Partial<Record<RouteType, number>>): string {
  const parts: string[] = [];
  let typed = 0;
  for (const type of ROUTE_TYPES) {
    const n = typeCounts[type] ?? 0;
    if (n === 0) continue;
    parts.push(countNoun(n, type));
    typed += n;
  }
  if (parts.length === 0) return countNoun(total, 'none');
  const untyped = total - typed;
  if (untyped > 0) parts.push(`${untyped} other ${untyped === 1 ? 'route' : 'routes'}`);
  if (parts.length === 1) return parts[0];
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
}

/** "Grades: boulder problems 4 to 7C, sport routes 6b." */
function gradesText(stats: CragRouteStats): string | undefined {
  const ranges = stats.gradeRanges ?? [];
  if (ranges.length === 0) return undefined;
  const items = ranges.map((range) => (range.type
    ? `${ROUTE_NOUNS[range.type].many} ${gradeSpanText(range)}`
    : gradeSpanText(range)));
  return `Grades: ${items.join(', ')}.`;
}

/** The count and grade sentences. Nothing for a place with no routes. */
function statSentences(stats: CragRouteStats | undefined): Array<string | undefined> {
  if (!stats || stats.routeCount === 0) return [];
  return [`${routeCountText(stats.routeCount, stats.typeCounts)}.`, gradesText(stats)];
}

/** "an 8A boulder problem", "a 6A sport route", "an ice or mixed route". */
function withArticle(phrase: string): string {
  return `${/^(8|11|18|[aeiou])/i.test(phrase) ? 'an' : 'a'} ${phrase}`;
}

/** The route type with at least 80% of the crag's typed routes, if any. */
export function dominantType(stats: CragRouteStats | undefined): RouteType | undefined {
  if (!stats) return undefined;
  let total = 0;
  let bestType: RouteType | undefined;
  let bestCount = 0;
  for (const type of ROUTE_TYPES) {
    const count = stats.typeCounts[type] ?? 0;
    if (count <= 0) continue;
    total += count;
    if (count > bestCount) {
      bestCount = count;
      bestType = type;
    }
  }
  if (!bestType || total === 0) return undefined;
  return bestCount / total >= DOMINANT_SHARE ? bestType : undefined;
}

/** "bouldering" for a crag that is mostly boulders. "climbing" when it has no clear type. */
export function cragDiscipline(stats: CragRouteStats | undefined): string {
  const type = dominantType(stats);
  return type ? DISCIPLINE_BY_TYPE[type] : 'climbing';
}

type CragSeoInput = Pick<Crag, 'cragName' | 'country' | 'description' | 'routeStats'>;
type SectorSeoInput = Pick<Sector, 'name' | 'routes' | 'altitude' | 'season'>;

/** Title and description for any page of a crag that has no sector or route of its own. */
export function buildCragSeo(crag: CragSeoInput): PageSeoText {
  const country = crag.country ? countryByCode(crag.country) : undefined;
  const discipline = cragDiscipline(crag.routeStats);
  return {
    title: `${crag.cragName} Climbing Guide`,
    description: description(
      `${crag.cragName} is a free ${discipline} guidebook${country ? ` in ${country.name}` : ''}.`,
      ...statSentences(crag.routeStats),
      crag.description?.trim(),
    ),
  };
}

export function buildSectorSeo(cragName: string, sector: SectorSeoInput): PageSeoText {
  const stats = foldRouteStats([{ geo: null, routes: sector.routes }]);
  return {
    title: `${sector.name} Sector - ${cragName} Climbing Guide`,
    description: description(
      `${sector.name} sector at ${cragName}.`,
      ...statSentences(stats),
      sector.altitude ? `Located at ${sector.altitude} altitude.` : undefined,
      sector.season ? `Best season: ${sector.season}.` : undefined,
    ),
  };
}

export function buildRouteSeo(
  cragName: string,
  sector: Pick<Sector, 'name'>,
  route: Pick<Route, 'name' | 'grade' | 'type' | 'description' | 'tags'>,
): PageSeoText {
  const grade = route.grade.trim();
  const noun = ROUTE_NOUNS[route.type ?? 'none'].one;
  const kind = grade && grade !== '?' ? `${grade} ${noun}` : noun;
  return {
    title: `${route.name} - ${sector.name} | ${cragName} Climbing`,
    description: description(
      `${route.name} is ${withArticle(kind)} at ${sector.name}, ${cragName}.`,
      route.description?.trim(),
      route.tags?.length ? `Features: ${route.tags.join(', ')}.` : undefined,
    ),
  };
}
