import { describe, expect, it } from 'vitest';
import { HttpError } from './http';
import { parseCragId, parseCragPatch, parseCreateCrag, parseSectorGeoPatch, parseSectorWrite } from './validate';

describe('validate', () => {
  it('slugifies the crag name when cragId is omitted', () => {
    expect(parseCreateCrag({ name: 'Roshka Valley' })).toEqual({
      name: 'Roshka Valley',
      cragId: 'roshka-valley',
    });
  });

  it('lowercases an explicit cragId', () => {
    expect(parseCragId('Roshka')).toBe('roshka');
  });

  it('rejects a PATCH that only sends version', () => {
    try {
      parseCragPatch({ version: 1 });
      throw new Error('expected parseCragPatch to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(HttpError);
      expect((error as HttpError).status).toBe(400);
    }
  });

  it('defaults sector geo to null and assigns route ids', () => {
    const sector = parseSectorWrite({
      name: 'Main Wall',
      routes: [{ name: 'Classic', grade: '6a' }],
    });
    expect(sector.geo).toBeNull();
    expect(sector.routes[0]?.id).toEqual(expect.any(String));
    expect(sector.routes[0]?.sectorName).toBe('Main Wall');
  });

  it('keeps route sector names aligned with the sector name', () => {
    const sector = parseSectorWrite({
      name: 'Main Wall',
      routes: [{ name: 'Classic', grade: '6a', sectorName: 'Cave' }],
    });
    expect(sector.routes[0]?.sectorName).toBe('Main Wall');
  });

  it('parses a sector coordinate patch and rejects latitudes outside range', () => {
    expect(parseSectorGeoPatch({ version: 1, geo: { lat: 42.5, lon: 45.2 } })).toEqual({
      version: 1,
      geo: { lat: 42.5, lon: 45.2 },
    });
    try {
      parseSectorGeoPatch({ version: 1, geo: { lat: 91, lon: 0 } });
      throw new Error('expected parseSectorGeoPatch to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(HttpError);
      expect((error as HttpError).status).toBe(400);
    }
  });

  it('parses a sector name patch and rejects a body with only a version', () => {
    expect(parseSectorGeoPatch({ version: 2, name: ' North Wall ' })).toEqual({
      version: 2,
      name: 'North Wall',
    });
    try {
      parseSectorGeoPatch({ version: 1 });
      throw new Error('expected parseSectorGeoPatch to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(HttpError);
      expect((error as HttpError).status).toBe(400);
      expect((error as HttpError).message).toBe(
        'PATCH body must include at least one sector field besides version',
      );
    }
    expect(parseSectorGeoPatch({ version: 1, name: 'Loaf 6*(^&%&$^%' })).toEqual({
      version: 1,
      name: 'Loaf 6*(^&%&$^%',
    });
  });

  it('parses sector detail fields and null clears', () => {
    expect(parseSectorGeoPatch({
      version: 3,
      altitude: ' 2000m ',
      approachTime: '30min',
      season: 'Apr; Jun; Aug - Oct',
      orientation: 'N, NW,',
      timeInSun: '02:30 -',
    })).toEqual({
      version: 3,
      altitude: '2000m',
      approachTime: '30min',
      season: 'Apr; Jun; Aug - Oct',
      orientation: 'N, NW,',
      timeInSun: '02:30 -',
    });
    expect(parseSectorGeoPatch({ version: 4, season: null, timeInSun: null })).toEqual({
      version: 4,
      season: null,
      timeInSun: null,
    });
    try {
      parseSectorGeoPatch({ version: 1, altitude: '   ' });
      throw new Error('expected parseSectorGeoPatch to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(HttpError);
      expect((error as HttpError).status).toBe(400);
    }
  });

  it('parses a routes patch, assigns ids, and keeps an empty grade and a duplicate name', () => {
    const parsed = parseSectorGeoPatch({
      version: 2,
      routes: [{ id: 'route-1', name: ' Classic ', grade: '6A', height: 5, type: 'Boulder', tags: ['Crimpers'] }],
    });
    expect(parsed.routes).toEqual([
      expect.objectContaining({
        id: 'route-1',
        name: 'Classic',
        grade: '6A',
        height: 5,
        type: 'Boulder',
        tags: ['Crimpers'],
        description: '',
      }),
    ]);

    const created = parseSectorGeoPatch({
      version: 1,
      routes: [{ name: 'Direct', grade: '7A' }],
    });
    expect(created.routes?.[0]?.id).toEqual(expect.any(String));

    const kept = parseSectorGeoPatch({
      version: 1,
      routes: [
        { name: 'Classic', grade: '6A' },
        { name: ' classic ', grade: '' },
        { name: 'Ungraded' },
      ],
    });
    expect(kept.routes?.map((route) => ({ name: route.name, grade: route.grade }))).toEqual([
      { name: 'Classic', grade: '6A' },
      { name: 'classic', grade: '' },
      { name: 'Ungraded', grade: '' },
    ]);

    const typed = parseSectorGeoPatch({
      version: 1,
      routes: [
        { name: 'Classic', grade: '6A', type: '' },
        { name: 'Direct', grade: '7A', type: null },
        { name: 'Arete', grade: '6B', type: '   ' },
        { name: 'Sporty', grade: '6C', type: 'Sport' },
      ],
    });
    expect(typed.routes?.map((route) => route.type)).toEqual([undefined, undefined, undefined, 'Sport']);

    expect(parseSectorGeoPatch({
      version: 2,
      images: [
        { imageFile: ' b.jpg ' },
        { imageFile: 'a.jpg' },
      ],
    })).toEqual({
      version: 2,
      images: [
        { imageFile: 'b.jpg' },
        { imageFile: 'a.jpg' },
      ],
    });

    const withLine = parseSectorGeoPatch({
      version: 2,
      routes: [{
        name: 'Classic',
        images: [{
          imageFile: 'b.jpg',
          routeIndex: 0,
          line: [{ x: 0.1, y: 0.2 }, { x: 0.3, y: 0.4 }],
        }],
      }],
    });
    expect(withLine.routes?.[0]?.images).toEqual([{
      imageFile: 'b.jpg',
      routeIndex: 0,
      line: [{ x: 0.1, y: 0.2 }, { x: 0.3, y: 0.4 }],
    }]);

    try {
      parseSectorGeoPatch({
        version: 1,
        routes: [{ name: 'Classic', grade: '6A', height: 0 }],
      });
      throw new Error('expected parseSectorGeoPatch to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(HttpError);
      expect((error as HttpError).status).toBe(400);
    }
  });
});
