import { useCallback, useEffect, useState } from 'react';
import type * as L from 'leaflet';

/** Persisted across map remounts (e.g. navigate to sector and back). */
const fullscreenByCragId = new Map<string, boolean>();

/** CSS fullscreen state for the map widget, persisted per crag. */
export function useMapFullscreen(
  cragId: string,
  map: L.Map | null,
): {
  fullscreen: boolean;
  toggleFullscreen: () => void;
} {
  const [fullscreen, setFullscreen] = useState(() => fullscreenByCragId.get(cragId) ?? false);

  // Persist fullscreen intent.
  // Body scroll is locked for the whole Map page (see MapPage), including fullscreen.
  useEffect(() => {
    fullscreenByCragId.set(cragId, fullscreen);
  }, [fullscreen, cragId]);

  // Esc exits CSS fullscreen.
  useEffect(() => {
    if (!fullscreen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setFullscreen(false);
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [fullscreen]);

  // Keep Leaflet in sync when the container size changes (fullscreen toggle / remount).
  useEffect(() => {
    if (!map || typeof ResizeObserver === 'undefined') return;
    const container = map.getContainer();

    const observer = new ResizeObserver(() => {
      const { width, height } = container.getBoundingClientRect();
      if (width < 1 || height < 1) return;
      map.invalidateSize({ animate: false });
    });
    observer.observe(container);

    return () => observer.disconnect();
  }, [map]);

  const toggleFullscreen = useCallback(() => {
    setFullscreen((value) => !value);
  }, []);

  return { fullscreen, toggleFullscreen };
}
