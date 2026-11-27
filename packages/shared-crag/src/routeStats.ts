import {
  ROUTE_TYPES,
  type CragRouteStats,
  type GradeRange,
  type LatLng,
  type RouteType,
} from './types';

/** One sector, reduced to the fields the catalog fold needs. */
interface SectorRouteStatsInput {
  geo: LatLng | null;
  season?: string;
  altitude?: string;
  routes: ReadonlyArray<{ type?: RouteType; grade?: string }>;
}

/** French or Font style: `4`, `5+`, `6a`, `7B+`. */
const RANKED_GRADE = /^(\d+)([A-C])?(\+)?$/i;

type GradeRank = [number, number, number];

/** Number, then letter (none below A), then `+`. Undefined when the grade cannot be ranked. */
function gradeRank(grade: string): GradeRank | undefined {
  const match = RANKED_GRADE.exec(grade);
  if (!match) return undefined;
  const letter = match[2] ? match[2].toUpperCase().charCodeAt(0) - 64 : 0;
  return [Number(match[1]), letter, match[3] ? 1 : 0];
}

interface RankedGrade {
  text: string;
  rank: GradeRank;
}

function compareRanks(a: GradeRank, b: GradeRank): number {
  return a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
}

function span(grades: readonly RankedGrade[]): { min: string; max: string } | undefined {
  if (grades.length === 0) return undefined;
  const sorted = [...grades].sort((a, b) => compareRanks(a.rank, b.rank));
  return { min: sorted[0].text, max: sorted[sorted.length - 1].text };
}

function agreedText(values: readonly string[]): string | undefined {
  if (values.length === 0) return undefined;
  const first = values[0];
  return values.every((value) => value === first) ? first : undefined;
}

function finitePoint(geo: LatLng | null): LatLng | undefined {
  if (!geo) return undefined;
  if (!Number.isFinite(geo.lat) || !Number.isFinite(geo.lon)) return undefined;
  return geo;
}

function isRouteType(value: RouteType | undefined): value is RouteType {
  return value !== undefined && ROUTE_TYPES.includes(value);
}

/**
 * One range per route type. Routes with no type join the only type the crag
 * has, or form an untyped range when the crag has no typed routes.
 */
function gradeRanges(
  typed: ReadonlyMap<RouteType, RankedGrade[]>,
  untyped: readonly RankedGrade[],
  typeCounts: Partial<Record<RouteType, number>>,
): GradeRange[] {
  const typesPresent = ROUTE_TYPES.filter((type) => (typeCounts[type] ?? 0) > 0);
  if (typesPresent.length === 0) {
    const range = span(untyped);
    return range ? [range] : [];
  }
  const ranges: GradeRange[] = [];
  for (const type of typesPresent) {
    const grades = typed.get(type) ?? [];
    const range = span(typesPresent.length === 1 ? [...grades, ...untyped] : grades);
    if (range) ranges.push({ type, ...range });
  }
  return ranges;
}

export type { SectorRouteStatsInput };

/** "6A to 7B", or just "6A" when both ends match. */
export function gradeSpanText({ min, max }: Pick<GradeRange, 'min' | 'max'>): string {
  return min === max ? min : `${min} to ${max}`;
}

/**
 * Folds sector points, seasons, altitudes, and route types and grades
 * into the catalog totals for one crag. Grades that cannot be ranked,
 * such as `?`, `7B/7B+`, or `Project`, are skipped.
 */
export function foldRouteStats(sectors: readonly SectorRouteStatsInput[]): CragRouteStats {
  let routeCount = 0;
  const typeCounts: Partial<Record<RouteType, number>> = {};
  const typedGrades = new Map<RouteType, RankedGrade[]>();
  const untypedGrades: RankedGrade[] = [];
  const points: LatLng[] = [];
  const seasons: string[] = [];
  const altitudes: string[] = [];

  for (const sector of sectors) {
    const point = finitePoint(sector.geo);
    if (point) points.push(point);
    const season = sector.season?.trim();
    if (season) seasons.push(season);
    const altitude = sector.altitude?.trim();
    if (altitude) altitudes.push(altitude);

    for (const route of sector.routes) {
      routeCount += 1;
      const type = isRouteType(route.type) ? route.type : undefined;
      if (type) typeCounts[type] = (typeCounts[type] ?? 0) + 1;
      const text = route.grade?.trim() ?? '';
      const rank = gradeRank(text);
      if (!rank) continue;
      const bucket = type ? typedGrades.get(type) ?? [] : untypedGrades;
      bucket.push({ text, rank });
      if (type) typedGrades.set(type, bucket);
    }
  }

  const stats: CragRouteStats = { routeCount, typeCounts };
  const ranges = gradeRanges(typedGrades, untypedGrades, typeCounts);
  if (ranges.length > 0) stats.gradeRanges = ranges;
  if (points.length > 0) {
    stats.latitude = points.reduce((sum, point) => sum + point.lat, 0) / points.length;
    stats.longitude = points.reduce((sum, point) => sum + point.lon, 0) / points.length;
  }
  const season = agreedText(seasons);
  if (season) stats.season = season;
  const altitude = agreedText(altitudes);
  if (altitude) stats.altitude = altitude;
  return stats;
}
