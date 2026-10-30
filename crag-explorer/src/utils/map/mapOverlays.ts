import * as L from 'leaflet';
import { createRoot, type Root } from 'react-dom/client';
import { renderSectorMapInfo } from '../../components/map/SectorMapInfo';
import { CragContextType } from '../../context/CragContext';
import { CragData, CragMapMarker, CragMapTrail, LatLng, Sector } from '../../types';
import { createPieChartSVG, getSectorGradeCounts } from '../grades';
import { escapeHtml, markerLabelFromType } from './mapOverlayHelpers';
import { resolveTrailColor } from './mapUtils';
import {
  createSectorGeoEditor,
  type SectorEditPatch,
  type SectorGeoEditHost,
  type SectorGeoEditor,
} from './sectorGeoEditor';

const POPUP_VIEW_PADDING_PX = 12;
// Long enough for the click that left the coordinate field to arrive after blur.
const POPUP_MOVE_CLICK_MS = 400;

interface SectorPopupMoveGuard {
  /** True while a typed coordinate move must not be treated as the user closing the popup. */
  moving: boolean;
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

function markerInView(map: L.Map, geo: LatLng): boolean {
  const bounds = map.getBounds();
  if (!bounds.isValid()) return true;
  return bounds.contains([geo.lat, geo.lon]);
}

function popupAutoPan(marker: L.Marker): { popup?: L.Popup; autoPan: boolean } {
  const popup = marker.getPopup() ?? undefined;
  return { popup, autoPan: popup?.options.autoPan ?? true };
}

function setPopupAutoPan(popup: L.Popup | undefined, autoPan: boolean): void {
  if (!popup) return;
  popup.options.autoPan = autoPan;
}

// Leaflet's own popup autoPan uses stale layer coordinates while a pan is running
// and can shove the pin hundreds of pixels off center. Nudge from the real screen
// boxes after the centering pan has finished.
function nudgeOpenPopupIntoView(map: L.Map, marker: L.Marker): void {
  const popup = marker.getPopup();
  const element = popup?.getElement();
  if (!popup?.isOpen() || !element) return;
  const frame = map.getContainer().getBoundingClientRect();
  const box = element.getBoundingClientRect();
  const pad = POPUP_VIEW_PADDING_PX;
  let dx = 0;
  let dy = 0;
  if (box.right > frame.right - pad) dx = box.right - (frame.right - pad);
  if (box.left < frame.left + pad) dx = box.left - (frame.left + pad);
  if (box.bottom > frame.bottom - pad) dy = box.bottom - (frame.bottom - pad);
  if (box.top < frame.top + pad) dy = box.top - (frame.top + pad);
  if (dx !== 0 || dy !== 0) map.panBy([dx, dy], { animate: false });
}

function keepSectorPopupInView(marker: L.Marker, reopen = true): void {
  window.setTimeout(() => {
    window.requestAnimationFrame(() => {
      if (!marker.getElement()) return;
      if (!marker.isPopupOpen()) {
        if (reopen) marker.openPopup();
        return;
      }
      marker.getPopup()?.update();
    });
  }, 0);
}

function concealPopup(marker: L.Marker): void {
  const container = marker.getPopup()?.getElement();
  if (!container) return;
  // Leaflet fades the popup out over 200ms. A drag needs it gone immediately.
  container.style.transition = 'none';
  container.style.visibility = 'hidden';
}

function revealPopup(marker: L.Marker): void {
  const container = marker.getPopup()?.getElement();
  if (!container) return;
  container.style.visibility = '';
  container.style.transition = '';
}

function setSectorMarkerLabel(marker: L.Marker, name: string): void {
  const label = marker.getElement()?.querySelector('.label');
  if (!label) return;
  label.textContent = name;
}

function createSectorMarkerHost(
  marker: L.Marker,
  map: L.Map,
  sector: Sector,
  options: RenderMapOverlaysOptions,
  saveSectorGeo: (sector: Sector, patch: SectorEditPatch) => Promise<Sector>,
  popupMoveGuard: SectorPopupMoveGuard,
): SectorGeoEditHost {
  const sectorId = sector.id ?? '';
  let reopenTimer: number | null = null;
  let recenterEnd: (() => void) | null = null;
  let releaseMapClick: (() => void) | null = null;
  let releaseMapClickTimer: number | null = null;
  let popupMoveGeneration = 0;
  // The marker stays on the map after a save, so the next save must send the
  // version returned by the previous one.
  let savedSector = sector;

  function endPopupMoveHold(generation: number): void {
    if (generation !== popupMoveGeneration) return;
    if (releaseMapClickTimer != null) {
      window.clearTimeout(releaseMapClickTimer);
      releaseMapClickTimer = null;
    }
    releaseMapClick?.();
    releaseMapClick = null;
    // The click that left the field closes the popup in this turn. Stay "moving"
    // until that close has been ignored.
    window.setTimeout(() => {
      if (generation !== popupMoveGeneration) return;
      popupMoveGuard.moving = false;
    }, 0);
  }

  function holdPopupThroughMapClick(): void {
    const generation = ++popupMoveGeneration;
    popupMoveGuard.moving = true;
    if (!releaseMapClick) {
      const container = map.getContainer();
      const onClick = (event: Event) => {
        const popupElement = marker.getPopup()?.getElement();
        const target = event.target;
        // Save, Cancel, and the close button live in the popup and must still receive the click.
        if (popupElement && target instanceof Node && popupElement.contains(target)) return;
        event.stopPropagation();
        endPopupMoveHold(popupMoveGeneration);
      };
      container.addEventListener('click', onClick, true);
      releaseMapClick = () => {
        container.removeEventListener('click', onClick, true);
      };
    }
    if (releaseMapClickTimer != null) window.clearTimeout(releaseMapClickTimer);
    releaseMapClickTimer = window.setTimeout(() => {
      endPopupMoveHold(generation);
    }, POPUP_MOVE_CLICK_MS);
  }

  return {
    setEditing(editing) {
      marker.getElement()?.classList.toggle('custom-marker--editing', editing);
      // Entering and leaving edit mode both re-render the popup under the pointer.
      // Pan it back into view once the new layout is measured. Leaving edit mode
      // must not reopen a popup the user closed, or one another marker replaced.
      keepSectorPopupInView(marker, editing);
    },
    setDragging(enabled) {
      if (enabled) marker.dragging?.enable();
      else marker.dragging?.disable();
    },
    setLatLng(geo) {
      const { popup, autoPan } = popupAutoPan(marker);
      setPopupAutoPan(popup, false);
      // Blur runs on mousedown, before the click. Once the pin jumps, that click
      // hits the map and Leaflet treats it as "close the popup".
      holdPopupThroughMapClick();
      marker.setLatLng([geo.lat, geo.lon]);
      setPopupAutoPan(popup, autoPan);
    },
    isInView(geo) {
      return markerInView(map, geo);
    },
    centerOn(geo) {
      const { popup, autoPan } = popupAutoPan(marker);
      setPopupAutoPan(popup, false);
      holdPopupThroughMapClick();
      if (recenterEnd) {
        map.off('moveend', recenterEnd);
        recenterEnd = null;
      }
      const target = L.latLng(geo.lat, geo.lon);
      const finish = () => {
        window.requestAnimationFrame(() => {
          if (!marker.getElement()) {
            setPopupAutoPan(popup, autoPan);
            return;
          }
          if (popupMoveGuard.moving && !marker.isPopupOpen()) marker.openPopup();
          nudgeOpenPopupIntoView(map, marker);
          setPopupAutoPan(popup, autoPan);
        });
      };
      if (map.getCenter().distanceTo(target) < 1) {
        finish();
        return;
      }
      // Jump instead of animating. A pan larger than the screen uses a CSS
      // translate that drops tiles which have not loaded yet, so the popup
      // never comes back before the click is delivered.
      recenterEnd = () => {
        recenterEnd = null;
        finish();
      };
      map.once('moveend', recenterEnd);
      map.panTo(target, { animate: false });
    },
    hidePopup() {
      concealPopup(marker);
      marker.closePopup();
      options.onSectorDragChange?.(sectorId, true);
    },
    showPopup() {
      options.onSectorDragChange?.(sectorId, false);
      if (reopenTimer != null) window.clearTimeout(reopenTimer);
      // Leaflet closes the popup when a drag starts. Reopen after dragend so the
      // popup is not created and torn down in the same event turn.
      reopenTimer = window.setTimeout(() => {
        reopenTimer = null;
        if (!marker.getElement()) return;
        revealPopup(marker);
        marker.openPopup();
      }, 0);
    },
    async save(patch) {
      const previousName = savedSector.name;
      const saved = await saveSectorGeo(savedSector, patch);
      savedSector = saved;
      if (saved.name !== previousName) setSectorMarkerLabel(marker, saved.name);
      options.onSectorGeoSaved?.(saved);
      return saved;
    },
  };
}

function bindSectorDrag(marker: L.Marker, editor: SectorGeoEditor): void {
  marker.on('dragstart', () => {
    marker.getElement()?.classList.add('custom-marker--dragging');
    editor.beginDrag();
  });
  marker.on('drag', () => {
    const latLng = marker.getLatLng();
    editor.moveTo({ lat: latLng.lat, lon: latLng.lng });
  });
  marker.on('dragend', () => {
    marker.getElement()?.classList.remove('custom-marker--dragging');
    const latLng = marker.getLatLng();
    editor.endDrag({ lat: latLng.lat, lon: latLng.lng });
  });
}

function bindSectorPopup(
  marker: L.Marker,
  sector: Sector,
  navigate: (to: string) => void,
  options: RenderMapOverlaysOptions,
  geoEditor: SectorGeoEditor | null,
  popupMoveGuard: SectorPopupMoveGuard | null,
): void {
  const container = L.DomUtil.create('div', 'sector-map-info-popup-root');
  let root: Root | null = null;
  let unmountTimer: number | null = null;
  let unmounted = false;

  const render = () => {
    if (unmountTimer != null) {
      window.clearTimeout(unmountTimer);
      unmountTimer = null;
    }
    unmounted = false;
    if (!root) root = createRoot(container);
    renderSectorMapInfo(
      root,
      { sector, navigate, geoEditor },
      options.cragContext,
    );
    keepSectorPopupInView(marker);
  };

  const scheduleUnmount = () => {
    if (!root || unmounted || unmountTimer != null) return;
    const current = root;
    unmountTimer = window.setTimeout(() => {
      unmountTimer = null;
      if (unmounted) return;
      unmounted = true;
      current.unmount();
      if (root === current) root = null;
    }, 0);
  };

  marker.bindPopup(container, {
    maxWidth: 640,
    className: 'sector-map-info-popup',
    // Clear the zoom control in the corner. The default padding leaves the
    // sector name underneath it.
    autoPanPaddingTopLeft: [48, 48],
    autoPanPaddingBottomRight: [48, 16],
  });
  marker.on('popupopen', render);
  let dragStarts = 0;
  marker.on('dragstart', () => {
    dragStarts += 1;
  });
  marker.on('popupclose', () => {
    if (!geoEditor) {
      scheduleUnmount();
      return;
    }
    // Leaflet closes the popup just before it fires dragstart, and a quick flick
    // can also deliver dragend before this timer runs. Count drag starts instead
    // of checking whether a drag is still in progress.
    const dragStartsAtClose = dragStarts;
    const movingAtClose = popupMoveGuard?.moving ?? false;
    if (!movingAtClose) scheduleUnmount();
    window.setTimeout(() => {
      if (dragStarts !== dragStartsAtClose) return;
      if (movingAtClose) {
        if (marker.getElement() && !marker.isPopupOpen()) marker.openPopup();
        return;
      }
      geoEditor.dismiss();
    }, 0);
  });
  marker.on('remove', () => {
    if (unmountTimer != null) {
      window.clearTimeout(unmountTimer);
      unmountTimer = null;
    }
    scheduleUnmount();
  });
}

function addSectorMarker(
  overlay: L.LayerGroup,
  sector: Sector,
  navigate: (to: string) => void,
  options: RenderMapOverlaysOptions,
  takenNames: readonly string[],
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

  const sectorId = sector.id;
  const saveSectorGeo = options.saveSectorGeo;
  const editable = Boolean(
    options.canEditSectorGeo
    && saveSectorGeo
    && sectorId
    && typeof sector.version === 'number',
  );

  const marker = L.marker([sector.geo.lat, sector.geo.lon], {
    icon,
    autoPan: editable,
  }).addTo(overlay);

  let editor: SectorGeoEditor | null = null;
  const popupMoveGuard: SectorPopupMoveGuard | null = editable ? { moving: false } : null;
  if (editable && saveSectorGeo && sectorId && popupMoveGuard) {
    editor = createSectorGeoEditor({
      geo: sector.geo,
      name: sector.name,
      takenNames,
      host: createSectorMarkerHost(
        marker,
        options.map,
        sector,
        options,
        saveSectorGeo,
        popupMoveGuard,
      ),
    });
    options.editors?.set(sectorId, editor);
    bindSectorDrag(marker, editor);
  }

  marker.on('remove', () => {
    editor?.dispose();
  });

  if (options.mode === 'bottom-panel') {
    marker.on('click', (event: L.LeafletMouseEvent) => {
      L.DomEvent.stopPropagation(event);
      if (event.originalEvent) {
        L.DomEvent.stopPropagation(event.originalEvent);
      }
      options.onSectorSelect?.(sector);
    });
    return;
  }

  bindSectorPopup(marker, sector, navigate, options, editor, popupMoveGuard);
  if (sectorId && options.openPopupForSectorId === sectorId) {
    marker.openPopup();
  }
}

function addMapMarker(overlay: L.LayerGroup, markerData: CragMapMarker): void {
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

  L.marker([markerData.geo.lat, markerData.geo.lon], { icon }).addTo(overlay).bindPopup(popupHtml, { maxWidth: 280 });
}

function addTrail(overlay: L.LayerGroup, trail: CragMapTrail): void {
  if (trail.points.length < 2) return;

  const color = resolveTrailColor(trail.color);
  const line = L.polyline(
    trail.points.map((point): L.LatLngTuple => [point.lat, point.lon]),
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
  map: L.Map;
  canEditSectorGeo: boolean;
  editors?: Map<string, SectorGeoEditor>;
  /** Reopen this sector popup after a coordinate save redraws the layers. */
  openPopupForSectorId?: string | null;
  onSectorGeoSaved?: (sector: Sector) => void;
  onSectorDragChange?: (sectorId: string, dragging: boolean) => void;
  saveSectorGeo?: (sector: Sector, patch: SectorEditPatch) => Promise<Sector>;
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
    const takenNames = cragData.sectors
      .filter((other) => other !== sector)
      .map((other) => other.name);
    addSectorMarker(overlay, sector, navigate, options, takenNames);
  }
  for (const marker of cragData.markers ?? []) {
    addMapMarker(overlay, marker);
  }
  for (const trail of cragData.trails ?? []) {
    addTrail(overlay, trail);
  }
}
