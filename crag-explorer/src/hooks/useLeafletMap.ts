import { useEffect, useRef, useState, type RefObject } from 'react';
import * as L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { CragData } from '../types';
import {
  applyInitialMapView,
  attachBaseLayers,
  buildBaseLayerOptions,
  saveMapView,
} from '../utils/map/mapSetup';

export interface UseLeafletMapOptions {
  cragId: string;
  cragData: CragData;
  online: boolean;
}

/**
 * Create a Leaflet map in `containerRef` with base layers and the saved view for
 * the crag. The map is recreated when the crag or the online state changes, so
 * callers that hold Leaflet layers should depend on the returned instance.
 */
export function useLeafletMap(
  containerRef: RefObject<HTMLDivElement | null>,
  { cragId, cragData, online }: UseLeafletMapOptions,
): L.Map | null {
  const [map, setMap] = useState<L.Map | null>(null);
  // The initial view only needs the data at creation time.
  const cragDataRef = useRef(cragData);
  cragDataRef.current = cragData;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let cancelled = false;
    const instance = L.map(container);

    void buildBaseLayerOptions(cragId, online).then((options) => {
      if (cancelled) return;
      attachBaseLayers(instance, options);
    });

    const handleViewChange = () => saveMapView(cragId, instance);
    instance.on('moveend zoomend', handleViewChange);
    applyInitialMapView(instance, cragId, cragDataRef.current);
    setMap(instance);

    return () => {
      cancelled = true;
      instance.off('moveend zoomend', handleViewChange);
      saveMapView(cragId, instance);
      setMap(null);
      instance.remove();
    };
  }, [containerRef, cragId, online]);

  return map;
}
