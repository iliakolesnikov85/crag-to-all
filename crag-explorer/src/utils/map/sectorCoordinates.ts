import type { LatLng } from '../../types';

const COORDINATE_DECIMALS = 6;
const DECIMAL_PATTERN = /^[+-]?(?:\d+\.?\d*|\.\d+)$/;
const LATITUDE_ERROR = 'Latitude must be a number from -90 to 90.';
const LONGITUDE_ERROR = 'Longitude must be a number from -180 to 180.';

function parseDecimal(
  text: string,
  min: number,
  max: number,
  rangeError: string,
): CoordinateParseResult {
  const trimmed = text.trim();
  if (!trimmed) return { ok: false, error: rangeError };
  const normalized = trimmed.replace(',', '.');
  if (!DECIMAL_PATTERN.test(normalized)) return { ok: false, error: rangeError };
  const value = Number(normalized);
  if (!Number.isFinite(value) || value < min || value > max) {
    return { ok: false, error: rangeError };
  }
  return { ok: true, value };
}

export interface CoordinateParseSuccess {
  ok: true;
  value: number;
}

export interface CoordinateParseFailure {
  ok: false;
  error: string;
}

export type CoordinateParseResult = CoordinateParseSuccess | CoordinateParseFailure;

export function formatSectorCoordinate(value: number): string {
  return value.toFixed(COORDINATE_DECIMALS);
}

export function formatSectorCoordinatePair(geo: LatLng): string {
  return `${formatSectorCoordinate(geo.lat)}, ${formatSectorCoordinate(geo.lon)}`;
}

export function roundSectorGeo(geo: LatLng): LatLng {
  return {
    lat: Number(formatSectorCoordinate(geo.lat)),
    lon: Number(formatSectorCoordinate(geo.lon)),
  };
}

export function sameSectorGeo(a: LatLng, b: LatLng): boolean {
  return formatSectorCoordinate(a.lat) === formatSectorCoordinate(b.lat)
    && formatSectorCoordinate(a.lon) === formatSectorCoordinate(b.lon);
}

export function parseLatitude(text: string): CoordinateParseResult {
  return parseDecimal(text, -90, 90, LATITUDE_ERROR);
}

export function parseLongitude(text: string): CoordinateParseResult {
  return parseDecimal(text, -180, 180, LONGITUDE_ERROR);
}
