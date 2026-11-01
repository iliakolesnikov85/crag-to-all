import { useEffect, useRef } from 'react';
import * as L from 'leaflet';
import type { LatLng, Sector } from '../types';
import { createSectorMarkerIcon } from '../utils/map/overlayLayers';
import { sectorMarkerKey } from '../utils/map/sectorEditState';

const DRAGGING_CLASS = 'custom-marker--dragging';
const EDITING_CLASS = 'custom-marker--editing';

interface MarkerEntry {
  marker: L.Marker;
  iconSignature: string;
}

function toLatLng(latLng: L.LatLng): LatLng {
  return { lat: latLng.lat, lon: latLng.lng };
}

/** Name, routes, and images — not coordinates. Geo is applied with setLatLng. */
function sectorIconSignature(sector: Sector): string {
  const routes = sector.routes.map((route) => `${route.name}:${route.grade}`).join(',');
  const images = sector.images.map((image) => image.imageFile).join(',');
  return `${sector.name}\0${routes}\0${images}`;
}

export interface SectorMarkerEdit {
  key: string;
  geo: LatLng;
  dragging: boolean;
}

export interface SectorMarkerCallbacks {
  onSelect(key: string): void;
  onDragStart(): void;
  onDrag(geo: LatLng): void;
  onDragEnd(geo: LatLng): void;
}

/**
 * One Leaflet marker per sector with a location, keyed by sector id. Markers are
 * added, moved, relabelled, and removed in place so an edit survives data updates.
 * The edited marker follows `edit.geo` and can be dragged.
 */
export function useSectorMarkers(
  map: L.Map | null,
  sectors: readonly Sector[],
  edit: SectorMarkerEdit | null,
  callbacks: SectorMarkerCallbacks,
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

    for (const sector of sectors) {
      if (!sector.geo) continue;
      const key = sectorMarkerKey(sector);
      seen.add(key);
      const edited = edit?.key === key;
      const geo = edited ? edit.geo : sector.geo;

      let entry = entries.get(key);
      const iconSignature = sectorIconSignature(sector);
      if (!entry) {
        const marker = L.marker([geo.lat, geo.lon], {
          icon: createSectorMarkerIcon(sector),
          draggable: edited,
          autoPan: true,
          bubblingMouseEvents: false,
        });
        marker.on('click', () => callbacksRef.current.onSelect(key));
        marker.on('dragstart', () => {
          marker.getElement()?.classList.add(DRAGGING_CLASS);
          callbacksRef.current.onDragStart();
        });
        marker.on('drag', () => callbacksRef.current.onDrag(toLatLng(marker.getLatLng())));
        marker.on('dragend', () => {
          marker.getElement()?.classList.remove(DRAGGING_CLASS);
          callbacksRef.current.onDragEnd(toLatLng(marker.getLatLng()));
        });
        group.addLayer(marker);
        entry = { marker, iconSignature };
        entries.set(key, entry);
      } else {
        // Replacing the icon during a drag unbinds Leaflet's draggable from the pin.
        if (entry.iconSignature !== iconSignature && !(edited && edit.dragging)) {
          entry.marker.setIcon(createSectorMarkerIcon(sector));
          entry.iconSignature = iconSignature;
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
  }, [map, sectors, edit]);
}
