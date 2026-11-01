import { useCallback, useEffect, useRef, useState } from 'react';
import * as L from 'leaflet';

const ERROR_RESET_MS = 3000;
const MIN_LOCATION_ZOOM = 15;

/** Remembers tracking across Map tab remounts within this page session. */
let trackingEnabled = false;

interface TrackingResources {
  /** Identity of the watch currently allowed to touch the map. */
  session: object | null;
  watchId: number | null;
  circle: L.Circle | null;
  arrow: L.Marker | null;
  orientationHandler: ((event: DeviceOrientationEvent) => void) | null;
  last: L.LatLng | null;
}

function compassArrowIcon(heading: number): L.DivIcon {
  return L.divIcon({
    className: 'compass-arrow',
    html: `
      <svg width="40" height="40" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="1" dy="1" stdDeviation="2" flood-color="rgba(0,0,0,0.3)"/>
          </filter>
        </defs>
        <g transform="rotate(${heading}, 20, 20)">
          <path d="M20 5 L25 25 L20 20 L15 25 Z" fill="#ff4444" stroke="#cc0000" stroke-width="2" filter="url(#shadow)"/>
          <circle cx="20" cy="20" r="3" fill="#ffffff" stroke="#cc0000" stroke-width="1"/>
        </g>
      </svg>
    `,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
  });
}

function readCompassHeading(event: DeviceOrientationEvent): number | null {
  const webkitHeading = (event as DeviceOrientationEvent & {
    webkitCompassHeading?: number;
  }).webkitCompassHeading;

  // iOS Safari: true compass bearing (clockwise from north).
  if (typeof webkitHeading === 'number' && Number.isFinite(webkitHeading)) {
    return ((webkitHeading % 360) + 360) % 360;
  }

  // Absolute orientation: alpha is counter-clockwise from north.
  if (event.absolute && event.alpha !== null && Number.isFinite(event.alpha)) {
    return ((360 - event.alpha) % 360 + 360) % 360;
  }

  // Relative alpha (common default) is not a compass heading.
  return null;
}

function stopOrientationWatch(resources: TrackingResources): void {
  const handler = resources.orientationHandler;
  if (!handler) return;
  window.removeEventListener('deviceorientation', handler);
  window.removeEventListener('deviceorientationabsolute', handler as EventListener);
  resources.orientationHandler = null;
}

function startOrientationWatch(resources: TrackingResources, onHeading: (heading: number) => void): void {
  if (resources.orientationHandler || !('DeviceOrientationEvent' in window)) return;

  const handler = (event: DeviceOrientationEvent) => {
    const heading = readCompassHeading(event);
    if (heading !== null) onHeading(heading);
  };
  resources.orientationHandler = handler;

  const attach = () => {
    if (resources.orientationHandler !== handler) return;
    // Chrome/Android: absolute event is north-referenced when available.
    if ('ondeviceorientationabsolute' in window) {
      window.addEventListener('deviceorientationabsolute', handler as EventListener);
    }
    // iOS Safari (webkitCompassHeading) and other browsers.
    window.addEventListener('deviceorientation', handler);
  };

  const requestPermission = (DeviceOrientationEvent as unknown as {
    requestPermission?: () => Promise<string>;
  }).requestPermission;
  if (typeof requestPermission === 'function') {
    requestPermission.call(DeviceOrientationEvent).then((permission) => {
      if (permission === 'granted') attach();
    }).catch((error: unknown) => {
      console.warn('Device orientation permission was not granted:', error);
    });
  } else {
    attach();
  }
}

function clearLayers(resources: TrackingResources): void {
  resources.circle?.remove();
  resources.arrow?.remove();
  resources.circle = null;
  resources.arrow = null;
}

function stopTracking(resources: TrackingResources): void {
  // Retire the session before clearWatch, which can deliver a queued callback.
  resources.session = null;
  if (resources.watchId !== null) {
    navigator.geolocation.clearWatch(resources.watchId);
    resources.watchId = null;
  }
  stopOrientationWatch(resources);
  clearLayers(resources);
  resources.last = null;
}

export type LocationTrackingStatus = 'off' | 'loading' | 'on' | 'error';

export interface LocationTracking {
  status: LocationTrackingStatus;
  /** Start following the device location, or center on it when already tracking. */
  start(): void;
}

/** GPS position with accuracy circle and compass arrow on the map. */
export function useLocationTracking(map: L.Map | null): LocationTracking {
  const [status, setStatus] = useState<LocationTrackingStatus>('off');
  const resourcesRef = useRef<TrackingResources>({
    session: null,
    watchId: null,
    circle: null,
    arrow: null,
    orientationHandler: null,
    last: null,
  });
  const errorTimerRef = useRef<number | null>(null);

  const showError = useCallback(() => {
    trackingEnabled = false;
    setStatus('error');
    if (errorTimerRef.current != null) window.clearTimeout(errorTimerRef.current);
    errorTimerRef.current = window.setTimeout(() => {
      errorTimerRef.current = null;
      setStatus('off');
    }, ERROR_RESET_MS);
  }, []);

  const startWatching = useCallback((centerOnFirstFix: boolean) => {
    const resources = resourcesRef.current;
    if (!map) return;
    if (resources.watchId !== null) {
      if (resources.last) map.setView(resources.last, Math.max(map.getZoom(), MIN_LOCATION_ZOOM));
      return;
    }
    if (!navigator.geolocation) {
      showError();
      return;
    }

    trackingEnabled = true;
    let centerOnNextFix = centerOnFirstFix;
    setStatus('loading');
    const session = {};
    resources.session = session;

    resources.watchId = navigator.geolocation.watchPosition(
      (position) => {
        if (resources.session !== session) return;
        const { latitude, longitude, accuracy } = position.coords;
        const heading = position.coords.heading || 0;
        const latLng = L.latLng(latitude, longitude);
        resources.last = latLng;

        clearLayers(resources);
        resources.circle = L.circle(latLng, {
          radius: accuracy,
          color: '#3388ff',
          fillColor: '#3388ff',
          fillOpacity: 0.2,
          weight: 1,
        }).addTo(map);
        resources.arrow = L.marker(latLng, { icon: compassArrowIcon(heading) }).addTo(map);
        startOrientationWatch(resources, (compassHeading) => {
          resources.arrow?.setIcon(compassArrowIcon(compassHeading));
        });

        if (centerOnNextFix) {
          centerOnNextFix = false;
          map.setView(latLng, Math.max(map.getZoom(), MIN_LOCATION_ZOOM));
        }
        setStatus('on');
      },
      (error) => {
        if (resources.session !== session) return;
        console.error('Error getting location:', error);
        stopTracking(resources);
        showError();
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000,
      },
    );
  }, [map, showError]);

  // Resume tracking on a new map instance when it was on before; stop GPS when the map goes away.
  useEffect(() => {
    if (!map) return;
    const resources = resourcesRef.current;
    // map.remove() runs before this effect cleans up. Retire the watch inside
    // that call so a queued GPS fix cannot draw on the destroyed map.
    const stop = () => stopTracking(resources);
    map.on('unload', stop);
    if (trackingEnabled) startWatching(false);
    return () => {
      map.off('unload', stop);
      stopTracking(resources);
      if (errorTimerRef.current != null) {
        window.clearTimeout(errorTimerRef.current);
        errorTimerRef.current = null;
      }
      setStatus('off');
    };
  }, [map, startWatching]);

  const start = useCallback(() => startWatching(true), [startWatching]);

  return { status, start };
}
