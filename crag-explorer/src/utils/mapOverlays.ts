import * as L from 'leaflet';
import { CragData, CragMapMarker, CragMapTrail, Sector } from '../types';
import { mountSectorMapInfo } from '../components/SectorMapInfo';
import { CragContextType } from '../context/CragContext';
import { createPieChartSVG, getSectorGradeCounts } from './grades';
import {
  parseGeo,
  isLatLngValid,
  parseMarkerLatLng,
  parseTrailLatLngs,
} from './mapUtils';

export type SectorMarkerMode = 'popup' | 'bottom-panel';

export interface RenderMapOverlaysOptions {
  mode: SectorMarkerMode;
  onSectorSelect?: (sector: Sector) => void;
  cragContext: CragContextType;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function markerLabelFromType(type: string): string {
  const t = type.trim().toLowerCase();
  if (t === 'parking_space') return 'Parking';
  if (!t) return 'Map marker';
  return type.replace(/_/g, ' ');
}

function isParkingMarkerType(type: string): boolean {
  const t = type.trim().toLowerCase();
  return t === 'parking_space' || t.includes('parking');
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

function resolveTrailColor(rawColor: string | undefined): string {
  const raw = (rawColor || '').trim();
  if (
    /^#[0-9a-fA-F]{3}$/.test(raw) ||
    /^#[0-9a-fA-F]{6}$/.test(raw) ||
    /^#[0-9a-fA-F]{8}$/.test(raw)
  ) {
    return raw;
  }
  return '#c45c26';
}

function addSectorMarker(
  overlay: L.LayerGroup,
  sector: Sector,
  navigate: (to: string) => void,
  options: RenderMapOverlaysOptions,
): void {
  const geo = sector.geo ? parseGeo(sector.geo) : null;
  if (!geo || !isLatLngValid(geo[0], geo[1])) return;

  const gradeCounts = getSectorGradeCounts(sector);
  const svg = createPieChartSVG(gradeCounts, 30);
  const icon = L.divIcon({
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

  const marker = L.marker(geo, { icon }).addTo(overlay);

  if (options.mode === 'bottom-panel') {
    marker.on('click', (e: L.LeafletMouseEvent) => {
      L.DomEvent.stopPropagation(e);
      if (e.originalEvent) {
        L.DomEvent.stopPropagation(e.originalEvent);
      }
      options.onSectorSelect?.(sector);
    });
    return;
  }

  const container = L.DomUtil.create('div', 'sector-map-info-popup-root');
  let unmount: (() => void) | null = null;

  const cleanup = () => {
    unmount?.();
    unmount = null;
  };

  marker.bindPopup(container, {
    maxWidth: 640,
    className: 'sector-map-info-popup',
  });

  marker.on('popupopen', () => {
    if (unmount) return;
    unmount = mountSectorMapInfo(
      container,
      { sector, navigate },
      options.cragContext,
    );
  });
  marker.on('popupclose', cleanup);
  marker.on('remove', cleanup);
}

function addMapMarker(overlay: L.LayerGroup, m: CragMapMarker): void {
  const geo = parseMarkerLatLng(m);
  if (!geo) return;

  const parking = isParkingMarkerType(m.type);
  const html = parking
    ? createParkingMarkerIconHtml()
    : createDefaultMapMarkerIconHtml(markerLabelFromType(m.type));
  const icon = L.divIcon({
    className: parking
      ? 'custom-marker map-marker-host map-marker-host--parking'
      : 'custom-marker map-marker-host',
    html,
    iconSize: parking ? [34, 34] : [32, 32],
    iconAnchor: parking ? [17, 34] : [16, 32],
    popupAnchor: [0, -28],
  });

  const label = markerLabelFromType(m.type);
  const body = m.info.trim()
    ? escapeHtml(m.info.trim()).replace(/\n/g, '<br/>')
    : `<span class="map-popup-muted">${escapeHtml(label)}</span>`;
  const popupHtml = `<div class="map-popup map-popup--marker"><strong>${escapeHtml(label)}</strong><div class="map-popup-body">${body}</div></div>`;

  L.marker(geo, { icon }).addTo(overlay).bindPopup(popupHtml, { maxWidth: 280 });
}

function addTrail(overlay: L.LayerGroup, trail: CragMapTrail): void {
  const latlngs = parseTrailLatLngs(trail.points);
  if (latlngs.length < 2) return;

  const color = resolveTrailColor(trail.color);
  const line = L.polyline(latlngs, { color, weight: 4, opacity: 0.88 }).addTo(overlay);
  const title = escapeHtml(trail.name.trim()) || 'Trail';
  line.bindPopup(`<div class="map-popup map-popup--trail"><strong>${title}</strong></div>`);
}

/** Clear and redraw sectors, map markers, and trails on the overlay layer. */
export function renderMapOverlays(
  overlay: L.LayerGroup,
  cragData: CragData,
  navigate: (to: string) => void,
  options: RenderMapOverlaysOptions,
): void {
  overlay.clearLayers();

  for (const sector of cragData.sectors) {
    addSectorMarker(overlay, sector, navigate, options);
  }
  for (const marker of cragData.markers ?? []) {
    addMapMarker(overlay, marker);
  }
  for (const trail of cragData.trails ?? []) {
    addTrail(overlay, trail);
  }
}
