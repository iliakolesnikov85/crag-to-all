// Leaflet layer factories for sector pins, map markers, and trails.

import * as L from 'leaflet';
import type { CragMapMarker, CragMapMarkerType, CragMapTrail, Sector } from '../../types';
import { createPieChartSVG, getSectorGradeCounts } from '../grades';

const DEFAULT_TRAIL_COLOR = '#c45c26';
const HEX_COLOR = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function markerIconHtml(type: CragMapMarkerType): string {
  switch (type) {
    case 'parking_space':
      return `<div class="map-marker map-marker--parking" aria-hidden="true">
  <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32" focusable="false">
    <circle cx="16" cy="16" r="13" fill="#1565c0" stroke="#fff" stroke-width="2"/>
    <text x="16" y="21" text-anchor="middle" fill="#fff" font-size="15" font-weight="700" font-family="system-ui,Segoe UI,Arial,sans-serif">P</text>
  </svg>
</div>`;
    case 'water_tap':
      return `<div class="map-marker map-marker--water" aria-hidden="true">
  <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32" focusable="false">
    <path d="M16 3c0 0-9 11-9 17.5a9 9 0 0 0 18 0C25 14 16 3 16 3z" fill="#0288d1" stroke="#fff" stroke-width="2" stroke-linejoin="round"/>
  </svg>
</div>`;
    case 'camping':
      return `<div class="map-marker map-marker--camping" aria-hidden="true">
  <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="72 29 348 332" focusable="false">
    <path fill="#2e7d32" stroke="#fff" stroke-width="14" stroke-linejoin="round" fill-rule="evenodd" paint-order="stroke fill" d="M212.7 43 L196.5 53 L234.3 114.5 L102.9 328 L86 328 L86 347 L405 347 L405 328 L388.1 328 L256.7 114.5 L294.5 53 L278.3 43 L245.5 96.3 Z M245.6 191.1 L179.6 328 L204.9 328 L245.6 243.9 L286.1 328 L311.4 328 Z"/>
  </svg>
</div>`;
    case 'wc':
      return `<div class="map-marker map-marker--wc" aria-hidden="true">
  <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32" focusable="false">
    <circle cx="16" cy="16" r="13" fill="#00897b" stroke="#fff" stroke-width="2"/>
    <text x="16" y="20" text-anchor="middle" fill="#fff" font-size="11" font-weight="700" font-family="system-ui,Segoe UI,Arial,sans-serif">WC</text>
  </svg>
</div>`;
    default:
      return `<div class="map-marker map-marker--unknown" aria-hidden="true">
  <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32" focusable="false">
    <circle cx="16" cy="16" r="13" fill="#5c4033" stroke="#fff" stroke-width="2"/>
    <text x="16" y="21" text-anchor="middle" fill="#fff" font-size="16" font-weight="700" font-family="system-ui,sans-serif">?</text>
  </svg>
</div>`;
  }
}

export function markerLabelFromType(type: string): string {
  switch (type) {
    case 'parking_space':
      return 'Parking';
    case 'water_tap':
      return 'Water tap';
    case 'camping':
      return 'Camping';
    case 'wc':
      return 'WC';
    case 'unknown':
      return 'Unknown';
    default:
      return 'Map marker';
  }
}

export function resolveTrailColor(rawColor: string | undefined): string {
  const raw = (rawColor || '').trim();
  return HEX_COLOR.test(raw) ? raw : DEFAULT_TRAIL_COLOR;
}

export function createSectorMarkerIcon(sector: Sector): L.DivIcon {
  const svg = createPieChartSVG(getSectorGradeCounts(sector), 30);
  return L.divIcon({
    className: 'custom-marker',
    html: `
      <div class="marker-container">
        <div class="pie-chart">${svg}</div>
        <div class="label">${escapeHtml(sector.name)}</div>
      </div>
    `,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    popupAnchor: [0, -15],
  });
}

export function createMapMarkerIcon(type: CragMapMarkerType): L.DivIcon {
  return L.divIcon({
    className: 'custom-marker map-marker-host',
    html: markerIconHtml(type),
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -28],
  });
}

export function createMapMarker(markerData: CragMapMarker): L.Marker {
  return L.marker([markerData.geo.lat, markerData.geo.lon], {
    icon: createMapMarkerIcon(markerData.type),
  });
}

/** Returns null for a trail with fewer than two points. */
export function createTrailLine(trail: CragMapTrail): L.Polyline | null {
  if (trail.points.length < 2) return null;

  const color = resolveTrailColor(trail.color);
  const line = L.polyline(
    trail.points.map((point): L.LatLngTuple => [point.lat, point.lon]),
    { color, weight: 4, opacity: 0.88 },
  );
  const title = escapeHtml(trail.name.trim()) || 'Trail';
  line.bindPopup(`<div class="map-popup map-popup--trail"><strong>${title}</strong></div>`);
  return line;
}

export { escapeHtml };
