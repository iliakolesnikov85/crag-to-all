import { useEffect, useRef } from 'react';
import * as L from 'leaflet';
import type { LatLng } from '../types';

const PLACING_CLASS = 'leaflet-placing-sector';

function clickCameFromControl(event: L.LeafletMouseEvent): boolean {
  const target = event.originalEvent?.target;
  return target instanceof Element && target.closest('.leaflet-control') != null;
}

export interface PlacementModeCallbacks {
  /** The user clicked the map while placing. */
  onPlace(geo: LatLng): void;
  /** The user pressed Esc while placing. */
  onCancel(): void;
}

/** While `active`, the map shows a crosshair and the next click reports its location. */
export function usePlacementMode(
  map: L.Map | null,
  active: boolean,
  callbacks: PlacementModeCallbacks,
): void {
  const callbacksRef = useRef(callbacks);
  callbacksRef.current = callbacks;

  useEffect(() => {
    if (!active || !map) return;
    const container = map.getContainer();
    map.closePopup();
    L.DomUtil.addClass(container, PLACING_CLASS);

    const handleMapClick = (event: L.LeafletMouseEvent) => {
      // The Add-sector button lives inside the map. Its click must not drop the pin.
      if (clickCameFromControl(event)) return;
      callbacksRef.current.onPlace({ lat: event.latlng.lat, lon: event.latlng.lng });
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.stopPropagation();
      callbacksRef.current.onCancel();
    };

    // Attach after this gesture so the click that turned placing on cannot place.
    const listenTimer = window.setTimeout(() => {
      map.on('click', handleMapClick);
    }, 0);
    // Capture on window so Esc cancels placement without also leaving fullscreen.
    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.clearTimeout(listenTimer);
      L.DomUtil.removeClass(container, PLACING_CLASS);
      map.off('click', handleMapClick);
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [map, active]);
}
