// Leaflet layer factories for sector pins, map markers, and trails.

import * as L from 'leaflet';
import type { CragMapMarker, CragMapTrail, Sector } from '../../types';
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

function createParkingMarkerIconHtml(): string {
  return `<div class="map-marker map-marker--parking" aria-hidden="true">
  <svg xmlns="http://www.w3.org/2000/svg" width="34" height="34" viewBox="0 0 34 34" focusable="false">
    <circle cx="17" cy="17" r="15" fill="#1565c0" stroke="#fff" stroke-width="2"/>
    <text x="17" y="22" text-anchor="middle" fill="#fff" font-size="15" font-weight="700" font-family="system-ui,Segoe UI,Arial,sans-serif">P</text>
  </svg>
</div>`;
}

function createDefaultMapMarkerIconHtml(label: string): string {
  const safe = escapeHtml(label.slice(0, 3));
  return `<div class="map-marker map-marker--generic" aria-hidden="true">
  <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32" focusable="false">
    <circle cx="16" cy="16" r="13" fill="#5c4033" stroke="#fff" stroke-width="2"/>
    <text x="16" y="20" text-anchor="middle" fill="#fff" font-size="11" font-weight="700" font-family="system-ui,sans-serif">${safe}</text>
  </svg>
</div>`;
}

export function markerLabelFromType(type: string): string {
  switch (type) {
    case 'parking_space':
      return 'Parking';
    case 'water_tap':
      return 'Water tap';
    case 'camping':
      return 'Camping';
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

export function createMapMarker(markerData: CragMapMarker): L.Marker {
  const parking = markerData.type === 'parking_space';
  const label = markerLabelFromType(markerData.type);
  const html = parking
    ? createParkingMarkerIconHtml()
    : createDefaultMapMarkerIconHtml(label);
  const icon = L.divIcon({
    className: parking
      ? 'custom-marker map-marker-host map-marker-host--parking'
      : 'custom-marker map-marker-host',
    html,
    iconSize: parking ? [34, 34] : [32, 32],
    iconAnchor: parking ? [17, 34] : [16, 32],
    popupAnchor: [0, -28],
  });

  const body = markerData.info.trim()
    ? escapeHtml(markerData.info.trim()).replace(/\n/g, '<br/>')
    : `<span class="map-popup-muted">${escapeHtml(label)}</span>`;
  const popupHtml = `<div class="map-popup map-popup--marker"><strong>${escapeHtml(label)}</strong><div class="map-popup-body">${body}</div></div>`;

  return L.marker([markerData.geo.lat, markerData.geo.lon], { icon }).bindPopup(popupHtml, { maxWidth: 280 });
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
