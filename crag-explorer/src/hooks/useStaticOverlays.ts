import { useEffect } from 'react';
import * as L from 'leaflet';
import type { CragMapTrail } from '../types';
import { createTrailLine } from '../utils/map/overlayLayers';

/** Read-only approach trails. Rebuilt when the data changes. */
export function useStaticOverlays(
  map: L.Map | null,
  trails: readonly CragMapTrail[] | undefined,
): void {
  useEffect(() => {
    if (!map) return;
    const group = L.layerGroup().addTo(map);
    for (const trail of trails ?? []) {
      const line = createTrailLine(trail);
      if (line) group.addLayer(line);
    }
    return () => {
      group.remove();
    };
  }, [map, trails]);
}
