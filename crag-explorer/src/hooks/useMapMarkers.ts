import { useEffect, useRef } from 'react';
import * as L from 'leaflet';
import type { CragMapMarker, CragMapMarkerType, LatLng } from '../types';
import { bindPinDrag } from '../utils/map/bindPinDrag';
import { DRAFT_MARKER_KEY, markerKeyFromIndex } from '../utils/map/markerEditState';
import { createMapMarkerIcon } from '../utils/map/overlayLayers';

const EDITING_CLASS = 'custom-marker--editing';

interface MarkerEntry {
  marker: L.Marker;
  iconSignature: string;
}

interface MarkerPin {
  key: string;
  marker: CragMapMarker;
}

function pinsFrom(markers: readonly CragMapMarker[], draft: CragMapMarker | null): MarkerPin[] {
  const pins = markers.map((marker, index): MarkerPin => ({
    key: markerKeyFromIndex(index),
    marker,
  }));
  if (draft) pins.push({ key: DRAFT_MARKER_KEY, marker: draft });
  return pins;
}

export interface MapMarkerEdit {
  key: string;
  geo: LatLng;
  type: CragMapMarkerType;
  dragging: boolean;
}

export interface MapMarkerCallbacks {
  onSelect(key: string): void;
  onDragStart(): void;
  onDrag(geo: LatLng): void;
  onDragEnd(geo: LatLng): void;
}

/**
 * One Leaflet marker per crag map marker, keyed by array index. Markers are
 * added, moved, and restyled in place. The edited marker follows `edit` and
 * can be dragged. A draft pin uses DRAFT_MARKER_KEY and is not in `markers`.
 */
export function useMapMarkers(
  map: L.Map | null,
  markers: readonly CragMapMarker[],
  draft: CragMapMarker | null,
  edit: MapMarkerEdit | null,
  callbacks: MapMarkerCallbacks,
): void {
  const entriesRef = useRef(new Map<string, MarkerEntry>());
  const groupRef = useRef<L.LayerGroup | null>(null);
  const callbacksRef = useRef(callbacks);
  callbacksRef.current = callbacks;

  useEffect(() => {
    if (!map) return;
    const group = L.layerGroup().addTo(map);
    groupRef.current = group;
    return () => {
      group.remove();
      groupRef.current = null;
      entriesRef.current.clear();
    };
  }, [map]);

  useEffect(() => {
    const group = groupRef.current;
    if (!map || !group) return;
    const entries = entriesRef.current;
    const seen = new Set<string>();

    for (const pin of pinsFrom(markers, draft)) {
      const key = pin.key;
      seen.add(key);
      const edited = edit?.key === key;
      const geo = edited ? edit.geo : pin.marker.geo;
      const markerType = edited ? edit.type : pin.marker.type;

      let entry = entries.get(key);
      if (!entry) {
        const marker = L.marker([geo.lat, geo.lon], {
          icon: createMapMarkerIcon(markerType),
          draggable: edited,
          autoPan: true,
          bubblingMouseEvents: false,
        });
        marker.on('click', () => callbacksRef.current.onSelect(key));
        bindPinDrag(marker, {
          onDragStart: () => callbacksRef.current.onDragStart(),
          onDrag: (next) => callbacksRef.current.onDrag(next),
          onDragEnd: (next) => callbacksRef.current.onDragEnd(next),
        });
        group.addLayer(marker);
        entry = { marker, iconSignature: markerType };
        entries.set(key, entry);
      } else {
        // Replacing the icon during a drag unbinds Leaflet's draggable from the pin.
        if (entry.iconSignature !== markerType && !(edited && edit.dragging)) {
          entry.marker.setIcon(createMapMarkerIcon(markerType));
          entry.iconSignature = markerType;
        }
        // Leaflet moves the marker itself during a drag.
        if (!(edited && edit.dragging)) {
          const current = entry.marker.getLatLng();
          if (current.lat !== geo.lat || current.lng !== geo.lon) {
            entry.marker.setLatLng([geo.lat, geo.lon]);
          }
        }
      }

      entry.marker.getElement()?.classList.toggle(EDITING_CLASS, edited);
      if (edited) entry.marker.dragging?.enable();
      else entry.marker.dragging?.disable();
    }

    for (const [key, entry] of entries) {
      if (seen.has(key)) continue;
      group.removeLayer(entry.marker);
      entries.delete(key);
    }
  }, [map, markers, draft, edit]);
}
