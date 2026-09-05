import { Route, Sector } from '../types';
import { getBaseGrade, isUnknownGrade } from './grades';

function isNullOrEmpty(value: unknown): value is null | undefined | '' {
  return value === null || value === undefined || value === '';
}

function createEmptySectorRoute(sectorName: string): RouteListRow {
  return {
    name: '',
    grade: '',
    sectorName,
    description: '',
    tags: [],
    images: [],
    isEmptySector: true,
  };
}

export type SortField = 'name' | 'grade' | 'rating' | 'sectorName';

export type SortDirection = 'asc' | 'desc';

/** Routes list row: real routes, or UI placeholders for empty sectors. */
export type RouteListRow = Route & { isEmptySector?: boolean };

export function compareRouteValues(
  a: RouteListRow,
  b: RouteListRow,
  field: SortField,
  direction: SortDirection,
): number {
  let aValue = a[field];
  let bValue = b[field];
  const multiplier = direction === 'asc' ? 1 : -1;

  // Empty values always sink to the bottom, regardless of sort direction
  if (isNullOrEmpty(aValue) && isNullOrEmpty(bValue)) return 0;
  if (isNullOrEmpty(aValue)) return 1;
  if (isNullOrEmpty(bValue)) return -1;

  if (field === 'rating') {
    const aRating = a.rating ?? 0;
    const bRating = b.rating ?? 0;
    return multiplier * (aRating - bRating);
  }

  if (field === 'grade') {
    if (isUnknownGrade(aValue) && isUnknownGrade(bValue)) return 0;
    if (isUnknownGrade(aValue)) return 1;
    if (isUnknownGrade(bValue)) return -1;

    aValue = getBaseGrade(aValue as string) + ((aValue as string).includes('+') ? '1' : '0');
    bValue = getBaseGrade(bValue as string) + ((bValue as string).includes('+') ? '1' : '0');

    return multiplier * aValue.localeCompare(bValue, undefined, { numeric: true });
  }

  if (typeof aValue === 'string' && typeof bValue === 'string') {
    return multiplier * aValue.toLowerCase().localeCompare(bValue.toLowerCase());
  }

  if (aValue < bValue) return multiplier * -1;
  if (aValue > bValue) return multiplier * 1;
  return 0;
}

export function sortRouteRows(
  filteredRoutes: Route[],
  filteredSectors: Sector[],
  field: SortField,
  direction: SortDirection,
): RouteListRow[] {
  const artificialRoutes = filteredSectors
    .filter((sector) => sector.routes.length === 0)
    .map((sector) => createEmptySectorRoute(sector.name));

  return [...filteredRoutes, ...artificialRoutes].sort((a, b) =>
    compareRouteValues(a, b, field, direction),
  );
}
