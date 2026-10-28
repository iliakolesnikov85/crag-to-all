import { describe, expect, it } from 'vitest';
import {
  formatSectorCoordinate,
  formatSectorCoordinatePair,
  parseLatitude,
  parseLongitude,
  roundSectorGeo,
  sameSectorGeo,
} from './sectorCoordinates';

describe('sector coordinates', () => {
  it('formats a pair to six decimal places', () => {
    expect(formatSectorCoordinate(42.5)).toBe('42.500000');
    expect(formatSectorCoordinatePair({ lat: 42.5, lon: -45.2 })).toBe('42.500000, -45.200000');
  });

  it('treats values equal at display precision as the same point', () => {
    expect(sameSectorGeo({ lat: 42.5, lon: 45.2 }, { lat: 42.5000004, lon: 45.1999996 })).toBe(true);
    expect(sameSectorGeo({ lat: 42.5, lon: 45.2 }, { lat: 42.500002, lon: 45.2 })).toBe(false);
    expect(roundSectorGeo({ lat: 42.1234564, lon: -7 })).toEqual({ lat: 42.123456, lon: -7 });
  });

  it('parses latitudes and longitudes, including a comma decimal separator', () => {
    expect(parseLatitude(' 42,5 ')).toEqual({ ok: true, value: 42.5 });
    expect(parseLongitude('-180')).toEqual({ ok: true, value: -180 });
    expect(parseLatitude('90')).toEqual({ ok: true, value: 90 });
  });

  it('rejects empty, non-numeric, and out-of-range values', () => {
    expect(parseLatitude('')).toEqual({
      ok: false,
      error: 'Latitude must be a number from -90 to 90.',
    });
    expect(parseLatitude('12 degrees')).toMatchObject({ ok: false });
    expect(parseLatitude('91')).toMatchObject({ ok: false });
    expect(parseLongitude('181')).toEqual({
      ok: false,
      error: 'Longitude must be a number from -180 to 180.',
    });
  });
});
