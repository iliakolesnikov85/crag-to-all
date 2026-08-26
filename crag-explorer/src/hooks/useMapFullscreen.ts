import { createElement, useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as L from 'leaflet';
import { MdFullscreen, MdFullscreenExit } from 'react-icons/md';
import { createControlButton } from '../utils/mapControls/createControlButton';

type FullScreenControlInstance = L.Control & {
  _unbindFullscreenSync?: (() => void) | null;
};

const fullscreenIconHtml = renderToStaticMarkup(
  createElement(MdFullscreen, { size: 18 })
);
const exitFullscreenIconHtml = renderToStaticMarkup(
  createElement(MdFullscreenExit, { size: 18 })
);

/** Persisted across map remounts (e.g. navigate to sector and back). */
const fullscreenByCragId = new Map<string, boolean>();

function getMapFullscreenState(cragId: string): boolean {
  return fullscreenByCragId.get(cragId) ?? false;
}

function setMapFullscreenState(cragId: string, fullscreen: boolean): void {
  fullscreenByCragId.set(cragId, fullscreen);
}

function syncFullscreenButton(button: HTMLElement, isFullscreen: boolean): void {
  if (isFullscreen) {
    button.innerHTML = exitFullscreenIconHtml;
    button.title = 'Exit Fullscreen';
  } else {
    button.innerHTML = fullscreenIconHtml;
    button.title = 'View Fullscreen';
  }
}

/** CSS fullscreen state for the map widget, persisted per crag. */
export function useMapFullscreen(
  cragId: string,
  mapInstanceRef: RefObject<L.Map | null>,
  mapReady: boolean,
): {
  fullscreen: boolean;
  createFullScreenControl: () => new () => L.Control;
} {
  const [fullscreen, setFullscreen] = useState(() => getMapFullscreenState(cragId));
  const fullscreenRef = useRef(fullscreen);
  fullscreenRef.current = fullscreen;

  const listenersRef = useRef(new Set<() => void>());

  const toggleFullscreen = useCallback(() => {
    setFullscreen((value) => !value);
  }, []);
  const toggleFullscreenRef = useRef(toggleFullscreen);
  toggleFullscreenRef.current = toggleFullscreen;

  // Persist fullscreen intent and notify the Leaflet control.
  // Body scroll is locked for the whole Map page (see MapPage), including fullscreen.
  useEffect(() => {
    setMapFullscreenState(cragId, fullscreen);
    for (const listener of listenersRef.current) {
      listener();
    }
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
    if (!mapReady || !mapInstanceRef.current) return;
    const map = mapInstanceRef.current;
    const container = map.getContainer();

    const observer = new ResizeObserver(() => {
      const { width, height } = container.getBoundingClientRect();
      if (width < 1 || height < 1) return;
      map.invalidateSize({ animate: false });
    });
    observer.observe(container);

    return () => observer.disconnect();
  }, [mapReady, mapInstanceRef]);

  const createFullScreenControl = useCallback(() => {
    return L.Control.extend({
      options: {
        position: 'topleft',
      },

      onAdd: function(this: FullScreenControlInstance) {
        const { container, button } = createControlButton({
          className: 'leaflet-control-fullscreen',
          onClick: () => toggleFullscreenRef.current(),
        });

        syncFullscreenButton(button, fullscreenRef.current);

        const sync = () => syncFullscreenButton(button, fullscreenRef.current);
        listenersRef.current.add(sync);
        this._unbindFullscreenSync = () => {
          listenersRef.current.delete(sync);
        };

        return container;
      },

      onRemove: function(this: FullScreenControlInstance) {
        if (typeof this._unbindFullscreenSync === 'function') {
          this._unbindFullscreenSync();
          this._unbindFullscreenSync = null;
        }
      },
    }) as new () => L.Control;
  }, []);

  return {
    fullscreen,
    createFullScreenControl,
  };
}
