import { describe, expect, it } from 'vitest';
import { HttpError } from './http';
import { parseCragContentPatch, parseCragId, parseCragSettingsPatch, parseCreateCrag, parseSectorPatch, parseSectorWrite } from './validate';

describe('validate', () => {
  it('requires an explicit lowercase id and defaults source to explorer', () => {
    expect(parseCreateCrag({ id: ' roshka-valley ', name: 'Roshka Valley' })).toEqual({
      name: 'Roshka Valley',
      cragId: 'roshka-valley',
      source: 'explorer',
      country: 'GE',
    });
    for (const body of [
      { name: 'Roshka Valley' },
      { id: 'Roshka', name: 'Roshka' },
      { cragId: 'roshka', name: 'Roshka' },
      { id: 'roshka', name: 'Roshka', externalId: '35366' },
      { id: 'roshka', name: 'Roshka', source: 'external' },
    ]) {
      try {
        parseCreateCrag(body);
        throw new Error('expected parseCreateCrag to throw');
      } catch (error) {
        expect(error).toBeInstanceOf(HttpError);
        expect((error as HttpError).status).toBe(400);
      }
    }
    expect(parseCreateCrag({
      id: 'roshka',
      name: 'Roshka',
      source: 'external',
      externalId: ' 35366 ',
    })).toEqual({
      name: 'Roshka',
      cragId: 'roshka',
      source: 'external',
      externalId: '35366',
      country: 'GE',
    });
    try {
      parseCreateCrag({ id: 'Roshka', name: 'Roshka' });
      throw new Error('expected parseCreateCrag to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(HttpError);
      expect((error as HttpError).message).toBe(
        'id: id must be a lowercase slug (letters, digits, hyphens)',
      );
    }
  });

  it('rejects the reserved crag id', () => {
    try {
      parseCreateCrag({ id: 'crag-manage', name: 'Manage' });
      throw new Error('expected parseCreateCrag to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(HttpError);
      expect((error as HttpError).status).toBe(400);
      expect((error as HttpError).message).toBe('id: id is reserved');
    }
  });

  it('rejects opentopoTilePack on a crag patch', () => {
    const bodies = [
      () => parseCragContentPatch({
        version: 1,
        description: [],
        opentopoTilePack: null,
      }),
      () => parseCragSettingsPatch({
        version: 1,
        name: 'Roshka',
        opentopoTilePack: null,
      }),
    ];
    for (const parse of bodies) {
      try {
        parse();
        throw new Error('expected the crag patch parser to throw');
      } catch (error) {
        expect(error).toBeInstanceOf(HttpError);
        expect((error as HttpError).status).toBe(400);
      }
    }
  });

  it('lowercases an explicit cragId', () => {
    expect(parseCragId('Roshka')).toBe('roshka');
  });

  it('rejects a PATCH that only sends version', () => {
    for (const parse of [parseCragContentPatch, parseCragSettingsPatch]) {
      try {
        parse({ version: 1 });
        throw new Error('expected the crag patch parser to throw');
      } catch (error) {
        expect(error).toBeInstanceOf(HttpError);
        expect((error as HttpError).status).toBe(400);
      }
    }
  });

  it('keeps name and published off the content patch', () => {
    expect(parseCragContentPatch({
      version: 1,
      description: [{ subheader: 'Access', paragraphs: ['Walk in.'] }],
    })).toEqual({
      version: 1,
      description: [{ subheader: 'Access', paragraphs: ['Walk in.'] }],
    });
    try {
      parseCragContentPatch({ version: 1, name: 'Roshka', published: true });
      throw new Error('expected parseCragContentPatch to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(HttpError);
      expect((error as HttpError).status).toBe(400);
    }
  });

  it('defaults a missing country to Georgia and stores an explicit code', () => {
    expect(parseCreateCrag({ id: 'roshka', name: 'Roshka', country: ' fr ' })).toEqual({
      name: 'Roshka',
      cragId: 'roshka',
      source: 'explorer',
      country: 'FR',
    });
    expect(parseCragSettingsPatch({ version: 3, country: 'ge' })).toEqual({
      version: 3,
      country: 'GE',
    });
    try {
      parseCreateCrag({ id: 'roshka', name: 'Roshka', country: 'ZZ' });
      throw new Error('expected parseCreateCrag to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(HttpError);
      expect((error as HttpError).status).toBe(400);
      expect((error as HttpError).message).toBe(
        'country: Country must be an ISO 3166-1 alpha-2 code',
      );
    }
  });

  it('keeps description off the settings patch', () => {
    expect(parseCragSettingsPatch({ version: 2, name: ' Roshka ', published: false })).toEqual({
      version: 2,
      name: 'Roshka',
      published: false,
    });
    try {
      parseCragSettingsPatch({
        version: 1,
        description: [{ subheader: 'Access', paragraphs: ['Walk in.'] }],
      });
      throw new Error('expected parseCragSettingsPatch to throw');
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
    expect(parseSectorPatch({ version: 1, geo: { lat: 42.5, lon: 45.2 } })).toEqual({
      version: 1,
      geo: { lat: 42.5, lon: 45.2 },
    });
    try {
      parseSectorPatch({ version: 1, geo: { lat: 91, lon: 0 } });
      throw new Error('expected parseSectorPatch to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(HttpError);
      expect((error as HttpError).status).toBe(400);
    }
  });

  it('parses a sector name patch and rejects a body with only a version', () => {
    expect(parseSectorPatch({ version: 2, name: ' North Wall ' })).toEqual({
      version: 2,
      name: 'North Wall',
    });
    try {
      parseSectorPatch({ version: 1 });
      throw new Error('expected parseSectorPatch to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(HttpError);
      expect((error as HttpError).status).toBe(400);
      expect((error as HttpError).message).toBe(
        'PATCH body must include at least one sector field besides version',
      );
    }
    expect(parseSectorPatch({ version: 1, name: 'Loaf 6*(^&%&$^%' })).toEqual({
      version: 1,
      name: 'Loaf 6*(^&%&$^%',
    });
  });

  it('parses sector detail fields and null clears', () => {
    expect(parseSectorPatch({
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
    expect(parseSectorPatch({ version: 4, season: null, timeInSun: null })).toEqual({
      version: 4,
      season: null,
      timeInSun: null,
    });
    try {
      parseSectorPatch({ version: 1, altitude: '   ' });
      throw new Error('expected parseSectorPatch to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(HttpError);
      expect((error as HttpError).status).toBe(400);
    }
  });

  it('parses a routes patch, assigns ids, and keeps an empty grade and a duplicate name', () => {
    const parsed = parseSectorPatch({
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

    const created = parseSectorPatch({
      version: 1,
      routes: [{ name: 'Direct', grade: '7A' }],
    });
    expect(created.routes?.[0]?.id).toEqual(expect.any(String));

    const kept = parseSectorPatch({
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

    const typed = parseSectorPatch({
      version: 1,
      routes: [
        { name: 'Classic', grade: '6A', type: '' },
        { name: 'Direct', grade: '7A', type: null },
        { name: 'Arete', grade: '6B', type: '   ' },
        { name: 'Sporty', grade: '6C', type: 'Sport' },
      ],
    });
    expect(typed.routes?.map((route) => route.type)).toEqual([undefined, undefined, undefined, 'Sport']);

    expect(parseSectorPatch({
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

    const withLine = parseSectorPatch({
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
      parseSectorPatch({
        version: 1,
        routes: [{ name: 'Classic', grade: '6A', height: 0 }],
      });
      throw new Error('expected parseSectorPatch to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(HttpError);
      expect((error as HttpError).status).toBe(400);
    }
  });
});
