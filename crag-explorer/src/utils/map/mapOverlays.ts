import * as L from 'leaflet';
import { CragData, CragMapMarker, CragMapTrail, Sector } from '../../types';
import { mountSectorMapInfo } from '../../components/SectorMapInfo';
import { CragContextType } from '../../context/CragContext';
import { createPieChartSVG, getSectorGradeCounts } from '../grades';
import { resolveTrailColor } from './mapUtils';
import { escapeHtml, markerLabelFromType } from './mapOverlayHelpers';

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

function addSectorMarker(
  overlay: L.LayerGroup,
  sector: Sector,
  navigate: (to: string) => void,
  options: RenderMapOverlaysOptions,
): void {
  if (!sector.geo) return;

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

  const marker = L.marker([sector.geo.lat, sector.geo.lon], { icon }).addTo(overlay);

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
  const parking = m.type === 'parking_space';
  const label = markerLabelFromType(m.type);
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

  const body = m.info.trim()
    ? escapeHtml(m.info.trim()).replace(/\n/g, '<br/>')
    : `<span class="map-popup-muted">${escapeHtml(label)}</span>`;
  const popupHtml = `<div class="map-popup map-popup--marker"><strong>${escapeHtml(label)}</strong><div class="map-popup-body">${body}</div></div>`;

  L.marker([m.geo.lat, m.geo.lon], { icon }).addTo(overlay).bindPopup(popupHtml, { maxWidth: 280 });
}

function addTrail(overlay: L.LayerGroup, trail: CragMapTrail): void {
  if (trail.points.length < 2) return;

  const color = resolveTrailColor(trail.color);
  const line = L.polyline(
    trail.points.map((p): L.LatLngTuple => [p.lat, p.lon]),
    { color, weight: 4, opacity: 0.88 },
  ).addTo(overlay);
  const title = escapeHtml(trail.name.trim()) || 'Trail';
  line.bindPopup(`<div class="map-popup map-popup--trail"><strong>${title}</strong></div>`);
}

export type SectorMarkerMode = 'popup' | 'bottom-panel';

export interface RenderMapOverlaysOptions {
  mode: SectorMarkerMode;
  onSectorSelect?: (sector: Sector) => void;
  cragContext: CragContextType;
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
