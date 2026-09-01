import { describe, expect, it } from 'vitest';
import type { Route, Sector } from '../types';
import { sampleCragData } from '../test/fixtures/cragData';
import {
  compareRouteValues,
  sortRouteRows,
  type RouteListRow,
} from './routesSort';

function route(
  overrides: Partial<RouteListRow> & Pick<Route, 'name' | 'grade' | 'sectorName'>,
): RouteListRow {
  return {
    description: '',
    tags: [],
    images: [],
    ...overrides,
  };
}

function names(rows: RouteListRow[]): string[] {
  return rows.map((row) => row.name || `(empty:${row.sectorName})`);
}

describe('compareRouteValues', () => {
  it('sinks empty values regardless of sort direction', () => {
    const named = route({ name: 'Classic', grade: '6A', sectorName: 'A' });
    const empty = route({ name: '', grade: '6A', sectorName: 'A' });

    expect(compareRouteValues(named, empty, 'name', 'asc')).toBe(-1);
    expect(compareRouteValues(empty, named, 'name', 'asc')).toBe(1);
    expect(compareRouteValues(named, empty, 'name', 'desc')).toBe(-1);
    expect(compareRouteValues(empty, named, 'name', 'desc')).toBe(1);
    expect(compareRouteValues(empty, empty, 'name', 'asc')).toBe(0);
  });

  it('puts ? grades last in both directions', () => {
    const known = route({ name: 'a', grade: '6A', sectorName: 's' });
    const unknown = route({ name: 'b', grade: '?', sectorName: 's' });

    expect(compareRouteValues(known, unknown, 'grade', 'asc')).toBe(-1);
    expect(compareRouteValues(unknown, known, 'grade', 'asc')).toBe(1);
    expect(compareRouteValues(known, unknown, 'grade', 'desc')).toBe(-1);
    expect(compareRouteValues(unknown, known, 'grade', 'desc')).toBe(1);
    expect(compareRouteValues(unknown, unknown, 'grade', 'asc')).toBe(0);
  });

  it('sorts 6A before 6A+ in asc and after in desc', () => {
    const base = route({ name: 'a', grade: '6A', sectorName: 's' });
    const plus = route({ name: 'b', grade: '6A+', sectorName: 's' });

    expect(compareRouteValues(base, plus, 'grade', 'asc')).toBeLessThan(0);
    expect(compareRouteValues(plus, base, 'grade', 'asc')).toBeGreaterThan(0);
    expect(compareRouteValues(base, plus, 'grade', 'desc')).toBeGreaterThan(0);
    expect(compareRouteValues(plus, base, 'grade', 'desc')).toBeLessThan(0);
  });

  it('sinks missing ratings then compares numeric values', () => {
    const unrated = route({ name: 'a', grade: '6A', sectorName: 's' });
    const low = route({ name: 'b', grade: '6A', sectorName: 's', rating: 1 });
    const high = route({ name: 'c', grade: '6A', sectorName: 's', rating: 3 });

    expect(compareRouteValues(low, unrated, 'rating', 'asc')).toBe(-1);
    expect(compareRouteValues(unrated, low, 'rating', 'desc')).toBe(1);
    expect(compareRouteValues(low, high, 'rating', 'asc')).toBeLessThan(0);
    expect(compareRouteValues(low, high, 'rating', 'desc')).toBeGreaterThan(0);
  });
});

describe('sortRouteRows', () => {
  it('appends empty-sector placeholders and sinks them by empty name/grade', () => {
    const emptySector: Sector = {
      name: 'Empty Sector',
      geo: null,
      routes: [],
      images: [],
    };
    const sorted = sortRouteRows(
      sampleCragData.sectors[0].routes,
      [sampleCragData.sectors[0], emptySector],
      'grade',
      'asc',
    );

    expect(names(sorted)).toEqual([
      'Classic',
      'Mystery',
      '(empty:Empty Sector)',
    ]);
    expect(sorted[2]).toEqual({
      name: '',
      grade: '',
      sectorName: 'Empty Sector',
      description: '',
      tags: [],
      images: [],
      isEmptySector: true,
    });
  });
});
