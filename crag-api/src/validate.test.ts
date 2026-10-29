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
      expect((error as HttpError).message).toBe('PATCH body must include geo or name');
    }
    expect(parseSectorGeoPatch({ version: 1, name: 'Loaf 6*(^&%&$^%' })).toEqual({
      version: 1,
      name: 'Loaf 6*(^&%&$^%',
    });
  });
});
