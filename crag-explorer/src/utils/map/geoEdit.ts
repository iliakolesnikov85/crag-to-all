import type { LatLng } from '../../types';
import {
  formatSectorCoordinate,
  parseLatitude,
  parseLongitude,
  sameSectorGeo,
} from './sectorCoordinates';

export interface GeoEditFields {
  saving: boolean;
  dragging: boolean;
  originalGeo: LatLng;
  currentGeo: LatLng;
  latText: string;
  lonText: string;
  latError: string | null;
  lonError: string | null;
  saveError: string | null;
}

export type ParsedGeo =
  | { geo: LatLng }
  | { latError: string | null; lonError: string | null };

export function createGeoFields(geo: LatLng): GeoEditFields {
  return {
    saving: false,
    dragging: false,
    originalGeo: geo,
    currentGeo: geo,
    latText: formatSectorCoordinate(geo.lat),
    lonText: formatSectorCoordinate(geo.lon),
    latError: null,
    lonError: null,
    saveError: null,
  };
}

export function parseGeoFields(state: Pick<GeoEditFields, 'latText' | 'lonText'>): ParsedGeo {
  const lat = parseLatitude(state.latText);
  const lon = parseLongitude(state.lonText);
  if (lat.ok && lon.ok) return { geo: { lat: lat.value, lon: lon.value } };
  return {
    latError: lat.ok ? null : lat.error,
    lonError: lon.ok ? null : lon.error,
  };
}

export function withGeoText<T extends GeoEditFields>(state: T, geo: LatLng): T {
  return {
    ...state,
    currentGeo: geo,
    latText: formatSectorCoordinate(geo.lat),
    lonText: formatSectorCoordinate(geo.lon),
    latError: null,
    lonError: null,
    saveError: null,
  };
}

export function setGeoLatText<T extends GeoEditFields>(state: T, value: string): T {
  return { ...state, latText: value, latError: null, saveError: null };
}

export function setGeoLonText<T extends GeoEditFields>(state: T, value: string): T {
  return { ...state, lonText: value, lonError: null, saveError: null };
}

/** Move the pin from the typed coordinates, or keep it and show the error. */
export function commitGeoDraft<T extends GeoEditFields>(state: T): T {
  const parsed = parseGeoFields(state);
  if (!('geo' in parsed)) return { ...state, ...parsed };
  return withGeoText(state, parsed.geo);
}

export function beginGeoDrag<T extends GeoEditFields>(state: T): T {
  return { ...state, dragging: true };
}

export function moveGeoTo<T extends GeoEditFields>(state: T, geo: LatLng): T {
  return withGeoText(state, geo);
}

export function endGeoDrag<T extends GeoEditFields>(state: T, geo: LatLng): T {
  return withGeoText({ ...state, dragging: false }, geo);
}

export function sameGeo(a: LatLng, b: LatLng): boolean {
  return sameSectorGeo(a, b);
}
