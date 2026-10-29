import { describe, expect, it } from 'vitest';
import { SECTOR_NAME_MAX_LENGTH, validateSectorName } from './sectorName';

describe('validateSectorName', () => {
  it('trims a usable name', () => {
    expect(validateSectorName('  North Wall  ')).toEqual({ ok: true, name: 'North Wall' });
  });

  it('allows special symbols', () => {
    expect(validateSectorName('Loaf 6*(^&%&$^%')).toEqual({
      ok: true,
      name: 'Loaf 6*(^&%&$^%',
    });
  });

  it('accepts a name at the length limit', () => {
    const name = 'a'.repeat(SECTOR_NAME_MAX_LENGTH);
    expect(validateSectorName(name)).toEqual({ ok: true, name });
  });

  it('rejects an empty name', () => {
    expect(validateSectorName('   ')).toEqual({
      ok: false,
      error: 'Enter a sector name.',
    });
  });

  it('rejects a name longer than 200 characters', () => {
    expect(validateSectorName('a'.repeat(SECTOR_NAME_MAX_LENGTH + 1))).toEqual({
      ok: false,
      error: 'Sector name must be 200 characters or fewer.',
    });
  });

  it('rejects a name that matches another sector regardless of case', () => {
    expect(validateSectorName('cave', ['North Wall', 'Cave'])).toEqual({
      ok: false,
      error: 'A sector with this name already exists.',
    });
  });

  it('allows a case-only rename when the current name is not taken', () => {
    expect(validateSectorName('cave', ['North Wall'])).toEqual({ ok: true, name: 'cave' });
  });
});
