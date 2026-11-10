import * as L from 'leaflet';
import type { LatLng } from '../../types';

const DRAGGING_CLASS = 'custom-marker--dragging';

function toLatLng(latLng: L.LatLng): LatLng {
  return { lat: latLng.lat, lon: latLng.lng };
}

export interface PinDragCallbacks {
  onDragStart(): void;
  onDrag(geo: LatLng): void;
  onDragEnd(geo: LatLng): void;
}

/** Drag listeners shared by sector pins and map markers. */
export function bindPinDrag(marker: L.Marker, callbacks: PinDragCallbacks): void {
  marker.on('dragstart', () => {
    marker.getElement()?.classList.add(DRAGGING_CLASS);
    callbacks.onDragStart();
  });
  marker.on('drag', () => callbacks.onDrag(toLatLng(marker.getLatLng())));
  marker.on('dragend', () => {
    marker.getElement()?.classList.remove(DRAGGING_CLASS);
    callbacks.onDragEnd(toLatLng(marker.getLatLng()));
  });
}
