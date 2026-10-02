import { describe, expect, it } from 'vitest';
import { HttpError } from './http';
import { parseCragId, parseCragPatch, parseCreateCrag, parseSectorWrite } from './validate';

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
});
