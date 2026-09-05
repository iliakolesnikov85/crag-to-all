import { describe, expect, it } from 'vitest';
import type { Route, Sector } from '../types';
import { sampleCragData } from '../test/fixtures/cragData';
import {
  applyRouteFilters,
  getAvailableGrades,
  isGradeInRange,
  type RouteFilterState,
} from './routesFilter';

function makeRoute(
  overrides: Partial<Route> & Pick<Route, 'name' | 'grade' | 'sectorName'>,
): Route {
  return {
    description: '',
    tags: [],
    images: [],
    ...overrides,
  };
}

function makeSector(
  name: string,
  routes: Route[],
): Sector {
  return { name, geo: null, routes, images: [] };
}

function filters(overrides: Partial<RouteFilterState> = {}): RouteFilterState {
  return {
    gradeRange: [0, 2],
    textFilter: '',
    hideUnknownGrades: false,
    hideSectorsWithoutRoutes: false,
    ...overrides,
  };
}

const mixedSectors: Sector[] = [
  makeSector('Main Wall', [
    makeRoute({ name: 'Classic', grade: '6A+', sectorName: 'Main Wall' }),
    makeRoute({ name: 'Mystery', grade: '?', sectorName: 'Main Wall' }),
    makeRoute({ name: 'Pump', grade: '6B', sectorName: 'Main Wall' }),
    makeRoute({ name: 'Hard', grade: '6C', sectorName: 'Main Wall' }),
  ]),
  makeSector('Empty Sector', []),
];

describe('getAvailableGrades', () => {
  it('uses base grades, skips ?, and sorts numerically', () => {
    expect(
      getAvailableGrades([
        makeRoute({ name: 'a', grade: '6A+', sectorName: 's' }),
        makeRoute({ name: 'b', grade: '?', sectorName: 's' }),
        makeRoute({ name: 'f', grade: 'N/A', sectorName: 's' }),
        makeRoute({ name: 'c', grade: '', sectorName: 's' }),
        makeRoute({ name: 'd', grade: '6C', sectorName: 's' }),
        makeRoute({ name: 'e', grade: '6B', sectorName: 's' }),
      ]),
    ).toEqual(['6A', '6B', '6C']);
  });
});

describe('isGradeInRange', () => {
  const grades = ['6A', '6B', '6C'];
  const fullRange: [number, number] = [0, 2];
  const narrowed: [number, number] = [1, 2];

  it('includes unknown grades unless hide-unknown or the slider is narrowed', () => {
    expect(isGradeInRange('?', grades, fullRange, false)).toBe(true);
    expect(isGradeInRange('N/A', grades, fullRange, false)).toBe(true);
    expect(isGradeInRange(undefined, grades, fullRange, false)).toBe(true);
    expect(isGradeInRange('?', grades, fullRange, true)).toBe(false);
    expect(isGradeInRange('N/A', grades, fullRange, true)).toBe(false);
    expect(isGradeInRange('?', grades, narrowed, false)).toBe(false);
    expect(isGradeInRange('N/A', grades, narrowed, false)).toBe(false);
  });

  it('keeps known grades when the slider is not shown', () => {
    expect(isGradeInRange('6A+', ['6A'], [0, 0], false)).toBe(true);
    expect(isGradeInRange('6B', ['6A'], [0, 0], false)).toBe(true);
  });

  it('filters known grades by slider index and keeps grades missing from the list', () => {
    expect(isGradeInRange('6A+', grades, narrowed, false)).toBe(false);
    expect(isGradeInRange('6B', grades, narrowed, false)).toBe(true);
    expect(isGradeInRange('6C', grades, narrowed, false)).toBe(true);
    expect(isGradeInRange('7A', grades, narrowed, false)).toBe(true);
  });
});

describe('applyRouteFilters', () => {
  it('ignores a one-character text search and matches route or sector names after 2+', () => {
    const allNames = ['Classic', 'Mystery', 'Pump', 'Hard'];
    const oneChar = applyRouteFilters(mixedSectors, filters({ textFilter: 'C' }));
    expect(oneChar.filteredRoutes.map((r) => r.name)).toEqual(allNames);

    const paddedOneChar = applyRouteFilters(
      mixedSectors,
      filters({ textFilter: ' a ' }),
    );
    expect(paddedOneChar.filteredRoutes.map((r) => r.name)).toEqual(allNames);

    const byRoute = applyRouteFilters(mixedSectors, filters({ textFilter: 'Cl' }));
    expect(byRoute.filteredRoutes.map((r) => r.name)).toEqual(['Classic']);
    expect(byRoute.filteredSectors.map((s) => s.name)).toEqual(['Main Wall']);

    const bySector = applyRouteFilters(mixedSectors, filters({ textFilter: 'main' }));
    expect(bySector.filteredRoutes.map((r) => r.name)).toEqual([
      'Classic',
      'Mystery',
      'Pump',
      'Hard',
    ]);
  });

  it('drops sectors emptied by the route filter', () => {
    const result = applyRouteFilters(mixedSectors, filters({ textFilter: 'pump' }));
    expect(result.filteredSectors.map((s) => s.name)).toEqual(['Main Wall']);
    expect(result.filteredSectors[0].routes.map((r) => r.name)).toEqual(['Pump']);
  });

  it('keeps empty sectors unless hide-empty or a narrowed slider is on', () => {
    const kept = applyRouteFilters(
      mixedSectors,
      filters({ gradeRange: [0, 2] }),
    );
    expect(kept.filteredSectors.map((s) => s.name)).toEqual([
      'Main Wall',
      'Empty Sector',
    ]);

    const hiddenByCheckbox = applyRouteFilters(
      mixedSectors,
      filters({ gradeRange: [0, 2], hideSectorsWithoutRoutes: true }),
    );
    expect(hiddenByCheckbox.filteredSectors.map((s) => s.name)).toEqual([
      'Main Wall',
    ]);

    const hiddenBySlider = applyRouteFilters(
      mixedSectors,
      filters({ gradeRange: [1, 2] }),
    );
    expect(hiddenBySlider.filteredSectors.map((s) => s.name)).toEqual([
      'Main Wall',
    ]);
    expect(hiddenBySlider.filteredRoutes.map((r) => r.name)).toEqual([
      'Pump',
      'Hard',
    ]);
  });

  it('does not hide empty sectors for Hide ? grade', () => {
    const result = applyRouteFilters(
      mixedSectors,
      filters({ gradeRange: [0, 2], hideUnknownGrades: true }),
    );
    expect(result.filteredRoutes.map((r) => r.name)).toEqual([
      'Classic',
      'Pump',
      'Hard',
    ]);
    expect(result.filteredSectors.map((s) => s.name)).toEqual([
      'Main Wall',
      'Empty Sector',
    ]);
  });

  it('filters empty sectors by name when the text filter is active', () => {
    const miss = applyRouteFilters(
      mixedSectors,
      filters({ textFilter: 'zzz' }),
    );
    expect(miss.filteredSectors).toEqual([]);

    const hit = applyRouteFilters(
      mixedSectors,
      filters({ textFilter: 'empty' }),
    );
    expect(hit.filteredRoutes).toEqual([]);
    expect(hit.filteredSectors.map((s) => s.name)).toEqual(['Empty Sector']);
  });

  it('treats an uninitialized [0, 0] slider as narrowed when multiple grades exist', () => {
    const result = applyRouteFilters(
      mixedSectors,
      filters({ gradeRange: [0, 0] }),
    );
    expect(result.isGradeRangeSet).toBe(true);
    expect(result.filteredRoutes.map((r) => r.name)).toEqual(['Classic']);
    expect(result.filteredSectors.map((s) => s.name)).toEqual(['Main Wall']);
  });

  it('uses the sample fixture: one empty sector and unknown grades kept', () => {
    const result = applyRouteFilters(
      sampleCragData.sectors,
      filters({ gradeRange: [0, 0] }),
    );
    expect(result.availableGrades).toEqual(['6A']);
    expect(result.showGradeSlider).toBe(false);
    expect(result.filteredRoutes.map((r) => r.name)).toEqual([
      'Classic',
      'Mystery',
    ]);
    expect(result.filteredSectors.map((s) => s.name)).toEqual([
      'Main Wall',
      'Empty Sector',
    ]);
  });
});
