import { isCountryCode, searchCountries, validateCragCountry } from '@crag-to-all/shared-crag';
import { describe, expect, it } from 'vitest';

describe('countries', () => {
  it('accepts a known ISO code and rejects an unknown one', () => {
    expect(validateCragCountry('GE')).toEqual({ ok: true, value: 'GE' });
    expect(validateCragCountry(' ge ')).toEqual({ ok: true, value: 'GE' });
    expect(isCountryCode('GE')).toBe(true);
    expect(validateCragCountry('ZZ').ok).toBe(false);
    expect(isCountryCode('ZZ')).toBe(false);
    expect(validateCragCountry('').ok).toBe(false);
  });

  it('ranks an exact code, name, and domain ahead of a partial name', () => {
    for (const query of ['GE', 'Georgia', 'ge', '.ge']) {
      expect(searchCountries(query)[0]).toMatchObject({
        code: 'GE',
        name: 'Georgia',
        tld: 'ge',
      });
    }
    expect(searchCountries('Sudan')[0]?.code).toBe('SD');
    expect(searchCountries('Guinea')[0]?.code).toBe('GN');
    expect(searchCountries('Korea')[0]?.code).toBe('KR');
    expect(searchCountries('Congo')[0]?.code).toBe('CG');
  });

  it('finds common names and ignores accents', () => {
    expect(searchCountries('Turkey')[0]?.code).toBe('TR');
    expect(searchCountries('Czechia')[0]?.code).toBe('CZ');
    expect(searchCountries('USA')[0]?.code).toBe('US');
    expect(searchCountries('Cote')[0]?.code).toBe('CI');
    expect(searchCountries('Ivory Coast')[0]?.code).toBe('CI');
    expect(searchCountries('Curacao')[0]?.code).toBe('CW');
    expect(searchCountries('Reunion')[0]?.code).toBe('RE');
  });
});
