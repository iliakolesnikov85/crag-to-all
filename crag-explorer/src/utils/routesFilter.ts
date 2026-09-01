import { Route, Sector } from '../types';
import { getBaseGrade } from './grades';

function matchesEmptySectorTextFilter(
  sector: Sector,
  textFilter: string,
): boolean {
  const searchTerm = textFilter.toLowerCase().trim();
  if (searchTerm.length <= 1) return true;
  return sector.name.toLowerCase().includes(searchTerm);
}

function matchesTextFilter(route: Route, textFilter: string): boolean {
  const searchTerm = textFilter.toLowerCase().trim();
  if (searchTerm.length <= 1) return true;

  return (
    route.name.toLowerCase().includes(searchTerm) ||
    route.sectorName.toLowerCase().includes(searchTerm)
  );
}

export interface RouteFilterState {
  gradeRange: [number, number];
  textFilter: string;
  hideUnknownGrades: boolean;
  hideSectorsWithoutRoutes: boolean;
}

export interface RouteFilterResult {
  availableGrades: string[];
  showGradeSlider: boolean;
  isGradeRangeSet: boolean;
  filteredRoutes: Route[];
  filteredSectors: Sector[];
}

export function getAvailableGrades(routes: Route[]): string[] {
  const grades = new Set<string>();
  routes.forEach((route) => {
    if (route.grade && route.grade !== '?') {
      grades.add(getBaseGrade(route.grade));
    }
  });
  return Array.from(grades).sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true }),
  );
}

export function isGradeInRange(
  grade: string | undefined,
  availableGrades: string[],
  gradeRange: [number, number],
  hideUnknownGrades: boolean,
): boolean {
  if (!grade || grade === '?') {
    const sliderNarrowed =
      availableGrades.length > 1 &&
      (gradeRange[0] > 0 || gradeRange[1] < availableGrades.length - 1);
    return hideUnknownGrades || sliderNarrowed ? false : true;
  }

  if (availableGrades.length <= 1) return true;

  const baseGrade = getBaseGrade(grade);
  const gradeIndex = availableGrades.indexOf(baseGrade);

  if (gradeIndex === -1) return true;

  return gradeIndex >= gradeRange[0] && gradeIndex <= gradeRange[1];
}

export function applyRouteFilters(
  sectors: Sector[],
  options: RouteFilterState,
): RouteFilterResult {
  const routes = sectors.flatMap((sector) => sector.routes);
  const availableGrades = getAvailableGrades(routes);
  const showGradeSlider = availableGrades.length > 1;
  const isGradeRangeSet =
    showGradeSlider &&
    (options.gradeRange[0] > 0 ||
      options.gradeRange[1] < availableGrades.length - 1);

  const filteredRoutes = routes.filter(
    (route) =>
      isGradeInRange(
        route.grade,
        availableGrades,
        options.gradeRange,
        options.hideUnknownGrades,
      ) && matchesTextFilter(route, options.textFilter),
  );

  const filteredRouteIds = new Set(
    filteredRoutes.map(
      (route) => `${route.name.toLowerCase()}-${route.sectorName.toLowerCase()}`,
    ),
  );

  const filteredSectors = sectors.flatMap((sector) => {
    const hadNoRoutes = sector.routes.length === 0;
    const sectorRoutes = sector.routes.filter((route) =>
      filteredRouteIds.has(
        `${route.name.toLowerCase()}-${sector.name.toLowerCase()}`,
      ),
    );

    // Drop sectors emptied by the route filter.
    if (sectorRoutes.length === 0 && !hadNoRoutes) return [];

    // Empty sectors: respect text filter by sector name.
    if (hadNoRoutes && !matchesEmptySectorTextFilter(sector, options.textFilter)) {
      return [];
    }

    // Hide empty sectors when the grade slider is narrowed or the checkbox is on.
    // "Hide ? grade" does not apply — empty sectors have no grades.
    if (
      sectorRoutes.length === 0 &&
      (options.hideSectorsWithoutRoutes || isGradeRangeSet)
    ) {
      return [];
    }

    return [{ ...sector, routes: sectorRoutes }];
  });

  return {
    availableGrades,
    showGradeSlider,
    isGradeRangeSet,
    filteredRoutes,
    filteredSectors,
  };
}
