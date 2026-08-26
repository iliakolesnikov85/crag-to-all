// Base map layer factories and layer-control options for Leaflet.

import * as L from 'leaflet';
import {
  createCachedOpenTopoLayer,
  getCachedOpenTopoTilePack,
} from './offlineOpenTopoTiles';

const ESRI_SATELLITE_URL =
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
/** Outdoor topo tiles: contours, hillshade, peaks, trails, natural features (OSM + SRTM). */
const OPEN_TOPO_MAP_URL = 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png';
/** Official maps.gov.ge orthophoto tiles (direct; no api_key). */
const MAPS_GOV_GE_URL =
  'https://nt0.napr.gov.ge/NGCache?x={x}&y={y}&z={z}&l=ORTHO_GEORGIA_4';

interface MapBaseLayerOption {
  id: 'opentopo' | 'esri-satellite' | 'maps-gov-ge';
  label: string;
  create: () => L.TileLayer;
  /** True when this layer can render from the local offline pack. */
  offlineReady?: boolean;
}

function createOpenTopoLayer() {
  return L.tileLayer(OPEN_TOPO_MAP_URL, {
    attribution:
      'Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, SRTM | Map style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a> (<a href="https://creativecommons.org/licenses/by-sa/3.0/">CC-BY-SA</a>)',
    maxZoom: 19,
    maxNativeZoom: 17,
  });
}

function createEsriSatelliteLayer() {
  return L.tileLayer(ESRI_SATELLITE_URL, {
    attribution: 'Tiles &copy; Esri',
    maxZoom: 19,
    maxNativeZoom: 17,
  });
}

function createMapsGovGeLayer() {
  return L.tileLayer(MAPS_GOV_GE_URL, {
    attribution:
      '&copy; <a href="https://maps.gov.ge" target="_blank" rel="noopener noreferrer">maps.gov.ge</a>',
    maxZoom: 19,
  });
}

export async function buildBaseLayerOptions(
  cragId?: string,
  isOnline = true,
): Promise<MapBaseLayerOption[]> {
  let openTopoOption: MapBaseLayerOption = {
    id: 'opentopo',
    label: 'Outdoor / Topo',
    create: () => createOpenTopoLayer(),
  };

  if (!isOnline && cragId) {
    try {
      const pack = await getCachedOpenTopoTilePack(cragId);
      if (pack) {
        openTopoOption = {
          id: 'opentopo',
          label: 'Outdoor / Topo',
          offlineReady: true,
          create: () => createCachedOpenTopoLayer(cragId, pack),
        };
      }
    } catch (err) {
      console.warn('Could not load cached OpenTopo tiles:', err);
    }
  }

  return [
    openTopoOption,
    { id: 'maps-gov-ge', label: 'maps.gov.ge', create: () => createMapsGovGeLayer() },
    { id: 'esri-satellite', label: 'ESRI satellite', create: () => createEsriSatelliteLayer() },
  ];
}
