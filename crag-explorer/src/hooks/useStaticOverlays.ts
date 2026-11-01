import { useEffect } from 'react';
import * as L from 'leaflet';
import type { CragMapMarker, CragMapTrail } from '../types';
import { createMapMarker, createTrailLine } from '../utils/map/overlayLayers';

/** Read-only map markers (parking, water) and trails. Rebuilt when the data changes. */
export function useStaticOverlays(
  map: L.Map | null,
  markers: readonly CragMapMarker[] | undefined,
  trails: readonly CragMapTrail[] | undefined,
): void {
  useEffect(() => {
    if (!map) return;
    const group = L.layerGroup().addTo(map);
    for (const marker of markers ?? []) group.addLayer(createMapMarker(marker));
    for (const trail of trails ?? []) {
      const line = createTrailLine(trail);
      if (line) group.addLayer(line);
    }
    return () => {
      group.remove();
    };
  }, [map, markers, trails]);
}
