import * as L from 'leaflet';
import { CragData } from '../types';
import { computeCragBounds } from './mapUtils';
import { buildBaseLayerOptions } from './mapLayers';

interface SavedMapView {
  center: [number, number];
  zoom: number;
}

type BaseLayerOptions = Awaited<ReturnType<typeof buildBaseLayerOptions>>;

const mapViewByCragId = new Map<string, SavedMapView>();

const DEFAULT_CENTER: [number, number] = [42.5, 44.8];
const DEFAULT_ZOOM = 14;

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

/** Attach base tile layers and the Leaflet layers control. */
export function attachBaseLayers(map: L.Map, options: BaseLayerOptions): void {
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
