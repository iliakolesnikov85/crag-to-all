import { describe, expect, it } from 'vitest';
import { buildHomepageSeo } from './homepageSeo';
import type { Crag } from './types';

const ORIGIN = 'https://crags-for-all.web.app';

function crag(partial: Pick<Crag, 'id' | 'cragName'> & Partial<Crag>): Crag {
  return { published: true, ...partial };
}

function attraction(seo: ReturnType<typeof buildHomepageSeo>, name: string) {
  const list = seo.jsonLd[1];
  const items = list.itemListElement as Array<{ item: { name: string } }>;
  return items.find((entry) => entry.item.name === name)?.item;
}

describe('buildHomepageSeo', () => {
  it('uses a plain title when nothing is published', () => {
    const seo = buildHomepageSeo([
      crag({ id: 'draft', cragName: 'Draft', published: false, country: 'GE' }),
    ], ORIGIN);

    expect(seo.title).toBe('Crag Explorer');
    expect(seo.heading).toBe('Free climbing guidebooks');
    expect(seo.description).toBe(
      'Free climbing guidebooks. Topos, GPS, grades and seasons.',
    );
    expect(seo.image).toBe(`${ORIGIN}/header-bg.png`);
    expect(seo.jsonLd).toHaveLength(1);
  });

  it('names bouldering in one country and links each crag', () => {
    const seo = buildHomepageSeo([
      crag({
        id: 'roshka',
        cragName: 'Roshka',
        country: 'GE',
        description: 'Granite in the Caucasus.',
        routeStats: {
          routeCount: 40,
          typeCounts: { Boulder: 8, Sport: 2 },
          gradeRanges: [
            { type: 'Boulder', min: '6A', max: '7B' },
            { type: 'Sport', min: '6b', max: '6b' },
          ],
          latitude: 42.55,
          longitude: 44.87,
          season: 'June to October',
          altitude: '2500m',
        },
      }),
      crag({
        id: 'shulaveri',
        cragName: 'Shulaveri',
        country: 'GE',
        routeStats: { routeCount: 12, typeCounts: { Boulder: 12 } },
      }),
      crag({ id: 'hidden', cragName: 'Hidden', country: 'FR', published: false }),
    ], `${ORIGIN}/`);

    expect(seo.title).toBe(
      'Climbing in Georgia - Free Bouldering Guides | Roshka, Shulaveri',
    );
    expect(seo.heading).toBe('Climbing in Georgia');
    expect(seo.description).toContain('Roshka (bouldering, Georgia, 40 routes)');
    expect(seo.description).toContain('Shulaveri (bouldering, Georgia, 12 routes)');
    expect(seo.description.endsWith('Topos, GPS, grades and seasons.')).toBe(true);
    expect(seo.description).not.toContain('Hidden');

    const roshka = attraction(seo, 'Roshka') as {
      url: string;
      description: string;
      address: { addressCountry: string };
      geo: { latitude: number; longitude: number };
      amenityFeature: Array<{ name: string; value: string }>;
      additionalProperty: Array<{ name: string; value: number }>;
    };
    expect(roshka.url).toBe(`${ORIGIN}/roshka/overview`);
    expect(roshka.description).toBe('Granite in the Caucasus.');
    expect(roshka.address.addressCountry).toBe('GE');
    expect(roshka.geo).toEqual({
      '@type': 'GeoCoordinates',
      latitude: 42.55,
      longitude: 44.87,
    });
    expect(roshka.amenityFeature).toEqual([
      { '@type': 'LocationFeatureSpecification', name: 'Climbing Type', value: 'Bouldering' },
      { '@type': 'LocationFeatureSpecification', name: 'Boulder Grade Range', value: '6A to 7B' },
      { '@type': 'LocationFeatureSpecification', name: 'Sport Grade Range', value: '6b' },
      { '@type': 'LocationFeatureSpecification', name: 'Season', value: 'June to October' },
      { '@type': 'LocationFeatureSpecification', name: 'Altitude', value: '2500m' },
    ]);
    expect(roshka.additionalProperty).toEqual([
      { '@type': 'PropertyValue', name: 'Route Count', value: 40 },
    ]);
  });

  it('treats 80 percent as one discipline and a lower share as climbing', () => {
    const dominant = buildHomepageSeo([
      crag({
        id: 'wall',
        cragName: 'Wall',
        country: 'GE',
        routeStats: { routeCount: 10, typeCounts: { Boulder: 8, Sport: 2 } },
      }),
    ], ORIGIN);
    expect(dominant.title).toContain('Free Bouldering Guides');

    const mixed = buildHomepageSeo([
      crag({
        id: 'wall',
        cragName: 'Wall',
        country: 'GE',
        routeStats: { routeCount: 10, typeCounts: { Boulder: 7, Sport: 3 } },
      }),
    ], ORIGIN);
    expect(mixed.title).toContain('Free Climbing Guides');
  });

  it('names sport climbing alone, and falls back to climbing for other types', () => {
    const sport = crag({
      id: 'wall',
      cragName: 'Wall',
      routeStats: { routeCount: 5, typeCounts: { Sport: 5 } },
    });
    const ice = crag({
      id: 'ice',
      cragName: 'Ice',
      routeStats: { routeCount: 3, typeCounts: { 'Ice or Mixed': 3 } },
    });

    expect(buildHomepageSeo([sport], ORIGIN).title).toBe('Free Sport Climbing Guidebooks | Wall');
    expect(buildHomepageSeo([sport, ice], ORIGIN).title).toBe('Free Climbing Guidebooks | Wall, Ice');
  });

  it('names bouldering and sport climbing across countries, and keeps three names', () => {
    const seo = buildHomepageSeo([
      crag({
        id: 'roshka',
        cragName: 'Roshka',
        country: 'GE',
        routeStats: { routeCount: 10, typeCounts: { Boulder: 10 } },
      }),
      crag({
        id: 'font',
        cragName: 'Font',
        country: 'FR',
        routeStats: { routeCount: 4, typeCounts: { Sport: 4 } },
      }),
      crag({
        id: 'third',
        cragName: 'Third',
        country: 'FR',
        routeStats: { routeCount: 1, typeCounts: { Sport: 1 } },
      }),
      crag({
        id: 'fourth',
        cragName: 'Fourth',
        country: 'FR',
        routeStats: { routeCount: 1, typeCounts: { Sport: 1 } },
      }),
    ], ORIGIN);

    expect(seo.title).toBe(
      'Free Bouldering and Sport Climbing Guidebooks | Roshka, Font, Third',
    );
    expect(seo.heading).toBe('Free climbing guidebooks');
    expect(seo.title).not.toContain('Fourth');
  });

  it('lists the crags that fit in 160 characters and says there are more', () => {
    const seo = buildHomepageSeo(
      ['Roshka', 'Shulaveri', 'Mtskheta', 'Kazbegi'].map((name) => crag({
        id: name.toLowerCase(),
        cragName: name,
        country: 'GE',
        routeStats: { routeCount: 30, typeCounts: { Boulder: 30 } },
      })),
      ORIGIN,
    );

    expect(seo.description.length).toBeLessThanOrEqual(160);
    expect(seo.description).toContain('Roshka (bouldering, Georgia, 30 routes)');
    expect(seo.description).toContain(', and more.');
    expect(seo.description).not.toContain('Kazbegi');
    expect(seo.description.endsWith('Topos, GPS, grades and seasons.')).toBe(true);
  });

  it('cuts a single crag that is too long for the description', () => {
    const longName = 'North Wall '.repeat(30).trim();
    const seo = buildHomepageSeo(
      Array.from({ length: 8 }, (_, index) => crag({
        id: `crag-${index}`,
        cragName: `${longName} ${index}`,
        country: 'GE',
        routeStats: { routeCount: 3, typeCounts: { Boulder: 3 } },
      })),
      ORIGIN,
    );

    expect(seo.description.length).toBeLessThanOrEqual(160);
    expect(seo.description.startsWith('Free climbing guidebooks: North Wall')).toBe(true);
    expect(seo.description.endsWith('.')).toBe(true);
  });

  it('keeps the site name the same whatever the catalog holds', () => {
    const georgia = buildHomepageSeo([
      crag({ id: 'roshka', cragName: 'Roshka', country: 'GE' }),
    ], ORIGIN);
    const empty = buildHomepageSeo([], ORIGIN);

    expect(georgia.heading).toBe('Climbing in Georgia');
    expect(georgia.jsonLd[0].name).toBe('Crag Explorer');
    expect(empty.jsonLd[0].name).toBe('Crag Explorer');
    expect(georgia.jsonLd[1].name).toBe('Climbing in Georgia');
  });

  it('omits a grade range that the catalog could not fold', () => {
    const seo = buildHomepageSeo([
      crag({
        id: 'roshka',
        cragName: 'Roshka',
        country: 'GE',
        routeStats: { routeCount: 2, typeCounts: { Boulder: 2 } },
      }),
    ], ORIGIN);
    const item = attraction(seo, 'Roshka') as {
      amenityFeature: Array<{ name: string }>;
    };
    expect(item.amenityFeature.map((entry) => entry.name)).toEqual(['Climbing Type']);
  });

  it('names an untyped grade range without a route type', () => {
    const seo = buildHomepageSeo([
      crag({
        id: 'roshka',
        cragName: 'Roshka',
        routeStats: {
          routeCount: 2,
          typeCounts: {},
          gradeRanges: [{ min: '6A', max: '7A' }],
        },
      }),
    ], ORIGIN);
    const item = attraction(seo, 'Roshka') as {
      amenityFeature: Array<{ name: string; value: string }>;
    };
    expect(item.amenityFeature[1]).toEqual({
      '@type': 'LocationFeatureSpecification',
      name: 'Grade Range',
      value: '6A to 7A',
    });
  });

  it('leaves out the route count for a crag the refresh has not reached', () => {
    const seo = buildHomepageSeo([
      crag({ id: 'new', cragName: 'NewCrag', country: 'GE' }),
    ], ORIGIN);
    const item = attraction(seo, 'NewCrag') as Record<string, unknown>;

    expect(seo.description).toContain('NewCrag (climbing, Georgia)');
    expect(seo.description).not.toContain('routes');
    expect(item.additionalProperty).toBeUndefined();
    expect(item.geo).toBeUndefined();
  });
});
