import { describe, expect, it } from 'vitest';
import { foldRouteStats } from './routeStats';

describe('foldRouteStats', () => {
  it('returns an empty total when a crag has no sectors', () => {
    expect(foldRouteStats([])).toEqual({ routeCount: 0, typeCounts: {} });
  });

  it('averages points and keeps a season and altitude only when they agree', () => {
    const stats = foldRouteStats([
      {
        geo: { lat: 42, lon: 44 },
        season: 'June to October',
        altitude: '2500m',
        routes: [
          { type: 'Boulder', grade: '6A' },
          { type: 'Boulder', grade: '?' },
          { grade: '6B' },
        ],
      },
      {
        geo: { lat: 44, lon: 46 },
        season: 'June to October',
        altitude: '2500m',
        routes: [{ type: 'Sport', grade: '7A+' }],
      },
    ]);

    expect(stats).toEqual({
      routeCount: 4,
      typeCounts: { Boulder: 2, Sport: 1 },
      gradeRanges: [
        { type: 'Boulder', min: '6A', max: '6A' },
        { type: 'Sport', min: '7A+', max: '7A+' },
      ],
      latitude: 43,
      longitude: 45,
      season: 'June to October',
      altitude: '2500m',
    });
  });

  it('keeps boulder and sport grades in separate ranges', () => {
    const stats = foldRouteStats([
      {
        geo: null,
        routes: [
          { type: 'Sport', grade: '6b' },
          { type: 'Sport', grade: '5c' },
          { type: 'Boulder', grade: '7A' },
          { type: 'Boulder', grade: '5A' },
        ],
      },
    ]);

    expect(stats.gradeRanges).toEqual([
      { type: 'Boulder', min: '5A', max: '7A' },
      { type: 'Sport', min: '5c', max: '6b' },
    ]);
  });

  it('skips grades it cannot rank and keeps the rest of the range', () => {
    const stats = foldRouteStats([
      {
        geo: null,
        routes: [
          { type: 'Boulder', grade: '6A' },
          { type: 'Boulder', grade: '7B/7B+' },
          { type: 'Boulder', grade: 'V3' },
          { type: 'Boulder', grade: 'Project' },
          { type: 'Boulder', grade: 'N/A' },
          { type: 'Boulder', grade: '' },
          { type: 'Boulder', grade: '7C' },
        ],
      },
    ]);

    expect(stats.routeCount).toBe(7);
    expect(stats.gradeRanges).toEqual([{ type: 'Boulder', min: '6A', max: '7C' }]);
  });

  it('ranks grades with no letter below lettered ones', () => {
    const stats = foldRouteStats([
      {
        geo: null,
        routes: [
          { type: 'Boulder', grade: '6A' },
          { type: 'Boulder', grade: '5+' },
          { type: 'Boulder', grade: '4' },
          { type: 'Boulder', grade: '5' },
        ],
      },
    ]);

    expect(stats.gradeRanges).toEqual([{ type: 'Boulder', min: '4', max: '6A' }]);
  });

  it('counts routes with no type toward the only type the crag has', () => {
    const stats = foldRouteStats([
      {
        geo: null,
        routes: [
          { type: 'Boulder', grade: '6B' },
          { grade: '5+' },
          { grade: '8A' },
        ],
      },
    ]);

    expect(stats.gradeRanges).toEqual([{ type: 'Boulder', min: '5+', max: '8A' }]);
  });

  it('gives an untyped range when no route has a type', () => {
    const stats = foldRouteStats([
      { geo: null, routes: [{ grade: '6A' }, { grade: '7A' }] },
    ]);

    expect(stats.gradeRanges).toEqual([{ min: '6A', max: '7A' }]);
    expect(stats.typeCounts).toEqual({});
  });

  it('leaves the range out when no grade can be ranked', () => {
    const stats = foldRouteStats([
      { geo: null, routes: [{ type: 'Boulder', grade: '?' }, { type: 'Boulder', grade: 'V3' }] },
    ]);

    expect(stats.gradeRanges).toBeUndefined();
    expect(stats.routeCount).toBe(2);
  });

  it('drops season and altitude when sectors disagree', () => {
    const stats = foldRouteStats([
      { geo: null, season: 'Summer', altitude: '2500m', routes: [] },
      { geo: null, season: 'Winter', altitude: '400m', routes: [] },
    ]);

    expect(stats.season).toBeUndefined();
    expect(stats.altitude).toBeUndefined();
  });
});
