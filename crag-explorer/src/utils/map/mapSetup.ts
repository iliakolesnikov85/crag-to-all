// Map creation helpers: base tile layers, the layers control, and the saved view per crag.

import * as L from 'leaflet';
import { computeCragBounds } from '@crag-to-all/shared-crag';
import { CragData } from '../../types';
import {
  createCachedOpenTopoLayer,
  getCachedOpenTopoTilePack,
} from '../offline';

interface SavedMapView {
  center: [number, number];
  zoom: number;
}

interface MapBaseLayerOption {
  id: 'opentopo' | 'esri-satellite' | 'maps-gov-ge';
  label: string;
  create: () => L.TileLayer;
  /** True when this layer can render from the local offline pack. */
  offlineReady?: boolean;
}

const ESRI_SATELLITE_URL =
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
/** Outdoor topo tiles: contours, hillshade, peaks, trails, natural features (OSM + SRTM). */
const OPEN_TOPO_MAP_URL = 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png';
/** Official maps.gov.ge orthophoto tiles (direct; no api_key). */
const MAPS_GOV_GE_URL =
  'https://nt0.napr.gov.ge/NGCache?x={x}&y={y}&z={z}&l=ORTHO_GEORGIA_4';

const DEFAULT_CENTER: [number, number] = [42.5, 44.8];
const DEFAULT_ZOOM = 14;

const mapViewByCragId = new Map<string, SavedMapView>();

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

/** Attach base tile layers and the Leaflet layers control. */
export function attachBaseLayers(map: L.Map, options: MapBaseLayerOption[]): void {
  const defaultId = 'opentopo';
  const defaultOption = options.find((option) => option.id === defaultId) ?? options[0];
  const defaultLayer = defaultOption.create().addTo(map);

  const baseLayers: Record<string, L.TileLayer> = {};
  for (const option of options) {
    baseLayers[option.label] =
      option.id === defaultOption.id ? defaultLayer : option.create();
  }

  L.control.layers(baseLayers, undefined, { position: 'topright', collapsed: true }).addTo(map);
}

export function saveMapView(cragId: string, map: L.Map): void {
  const center = map.getCenter();
  mapViewByCragId.set(cragId, {
    center: [center.lat, center.lng],
    zoom: map.getZoom(),
  });
}

/** Set map center for a crag using the preferred zoom. */
export function setMapCenter(
  cragId: string,
  center: [number, number],
  preferredZoom: number = DEFAULT_ZOOM,
): void {
  mapViewByCragId.set(cragId, {
    center,
    zoom: preferredZoom,
  });
}

/** Fit the map to the crag's default bounds (or a fallback center). */
export function fitMapToCragBounds(map: L.Map, cragData: CragData): void {
  const bounds = computeCragBounds(cragData);
  if (!bounds) {
    map.setView(DEFAULT_CENTER, DEFAULT_ZOOM);
    return;
  }

  if (bounds.south === bounds.north && bounds.west === bounds.east) {
    map.setView([bounds.south, bounds.west], DEFAULT_ZOOM);
    return;
  }

  map.fitBounds(
    [
      [bounds.south, bounds.west],
      [bounds.north, bounds.east],
    ],
    { padding: [28, 28], maxZoom: 16 },
  );
}

/** Restore a previously saved view, or fit to crag bounds. */
export function applyInitialMapView(map: L.Map, cragId: string, cragData: CragData): void {
  const savedView = mapViewByCragId.get(cragId);
  if (savedView) {
    map.setView(savedView.center, savedView.zoom, { animate: false });
    return;
  }

  fitMapToCragBounds(map, cragData);
}
