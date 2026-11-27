import { describe, expect, it } from 'vitest';
import { buildCragSeo, buildRouteSeo, buildSectorSeo, trimToWord } from './pageSeo';
import type { Route, RouteType } from './types';

function route(name: string, grade: string, type?: RouteType): Route {
  return {
    id: name.toLowerCase(),
    name,
    grade,
    sectorName: 'Boulders',
    description: '',
    tags: [],
    images: [],
    ...(type ? { type } : {}),
  };
}

function sector(routes: Route[], extra: { altitude?: string; season?: string } = {}) {
  return { name: 'Boulders', routes, ...extra };
}

describe('buildRouteSeo', () => {
  const describeRoute = (item: Route) => buildRouteSeo('Roshka', { name: 'Boulders' }, item);

  it('names the route type and leaves out an unknown grade', () => {
    expect(describeRoute(route('Arete', '7a', 'Sport')).description).toBe(
      'Arete is a 7a sport route at Boulders, Roshka.',
    );
    expect(describeRoute(route('Mystery', '?', 'Boulder')).description).toBe(
      'Mystery is a boulder problem at Boulders, Roshka.',
    );
    expect(describeRoute(route('Plain', '6B')).description).toBe(
      'Plain is a 6B route at Boulders, Roshka.',
    );
    expect(describeRoute(route('Eight', '8A', 'Boulder')).description).toBe(
      'Eight is an 8A boulder problem at Boulders, Roshka.',
    );
  });

  it('adds the description and the tags, within 160 characters', () => {
    const item = {
      ...route('Classic', '6A', 'Boulder'),
      description: 'Start on the left crimp, traverse right to the big ledge, then mantel and top out.',
      tags: ['Crimpers', 'Slab'],
    };
    const { title, description } = describeRoute(item);

    expect(title).toBe('Classic - Boulders | Roshka Climbing');
    expect(description.startsWith('Classic is a 6A boulder problem at Boulders, Roshka. Start on')).toBe(true);
    expect(description.length).toBeLessThanOrEqual(160);
  });
});

describe('buildSectorSeo', () => {
  it('describes a sector with ranked grades per route type', () => {
    const { title, description } = buildSectorSeo('Roshka', sector([
      route('Hard', '7C', 'Boulder'),
      route('Slab', '6b', 'Sport'),
      route('Easy', '4', 'Boulder'),
      route('Unknown', '?', 'Boulder'),
      route('Old', '5c'),
    ]));

    expect(title).toBe('Boulders Sector - Roshka Climbing Guide');
    expect(description).toBe(
      'Boulders sector at Roshka. 3 boulder problems, 1 sport route and 1 other route. '
      + 'Grades: boulder problems 4 to 7C, sport routes 6b.',
    );
  });

  it('adds altitude and season, and says nothing about routes it does not have', () => {
    const { description } = buildSectorSeo('Roshka', sector([], {
      altitude: '2500m',
      season: 'June to October',
    }));

    expect(description).toBe(
      'Boulders sector at Roshka. Located at 2500m altitude. Best season: June to October.',
    );
  });
});

describe('buildCragSeo', () => {
  it('names the discipline, country, counts, grades, and excerpt', () => {
    const { title, description } = buildCragSeo({
      cragName: 'Roshka',
      country: 'GE',
      description: 'Granite in the Caucasus.',
      routeStats: {
        routeCount: 40,
        typeCounts: { Boulder: 40 },
        gradeRanges: [{ type: 'Boulder', min: '6A', max: '7B' }],
      },
    });

    expect(title).toBe('Roshka Climbing Guide');
    expect(description).toBe(
      'Roshka is a free bouldering guidebook in Georgia. 40 boulder problems. '
      + 'Grades: boulder problems 6A to 7B. Granite in the Caucasus.',
    );
  });

  it('describes a crag the refresh has not reached without counts', () => {
    expect(buildCragSeo({ cragName: 'NewCrag' }).description).toBe(
      'NewCrag is a free climbing guidebook.',
    );
    expect(buildCragSeo({
      cragName: 'Empty',
      routeStats: { routeCount: 0, typeCounts: {} },
    }).description).toBe('Empty is a free climbing guidebook.');
  });
});

describe('trimToWord', () => {
  it('returns text that already fits', () => {
    expect(trimToWord('Short text.', 160)).toBe('Short text.');
  });

  it('cuts at a word and never goes over the limit', () => {
    const text = 'word '.repeat(100);
    for (const max of [50, 51, 99, 160]) {
      const cut = trimToWord(text, max);
      expect(cut.length).toBeLessThanOrEqual(max);
      expect(cut.endsWith('word.')).toBe(true);
    }
  });

  it('cuts text with no spaces at the limit', () => {
    const cut = trimToWord('x'.repeat(200), 160);
    expect(cut).toHaveLength(160);
    expect(cut.endsWith('.')).toBe(true);
  });
});
