// Custom Location Control for Leaflet
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as L from 'leaflet';
import { MdErrorOutline, MdHourglassEmpty, MdLocationSearching, MdOutlineMyLocation } from 'react-icons/md';
import { createControlButton } from './createControlButton';

type LocationControlInstance = L.Control & {
  _stopTrackingResources?: (() => void) | null;
};

const locationOffIconHtml = renderToStaticMarkup(
  createElement(MdLocationSearching, { size: 18 })
);
const locationOnIconHtml = renderToStaticMarkup(
  createElement(MdOutlineMyLocation, { size: 18 })
);
const locationLoadingIconHtml = renderToStaticMarkup(
  createElement(MdHourglassEmpty, { size: 18 })
);
const locationErrorIconHtml = renderToStaticMarkup(
  createElement(MdErrorOutline, { size: 18 })
);

/** Remembers tracking across Map tab remounts within this page session. */
let trackingEnabled = false;

export const createLocationControl = () => {
  return L.Control.extend({
    options: {
      position: 'topleft'
    },

    onAdd: function(this: LocationControlInstance, map: L.Map) {
      let button!: HTMLAnchorElement;
      let locationCircle: L.Circle | null = null;
      let compassArrow: L.Marker | null = null;
      let watchId: number | null = null;
      let lastLat: number | null = null;
      let lastLng: number | null = null;
      let orientationHandler: ((event: DeviceOrientationEvent) => void) | null = null;
      let centerOnNextFix = false;

      const createCompassArrow = (lat: number, lng: number, heading: number) => {
        if (compassArrow) {
          map.removeLayer(compassArrow);
        }

        const arrowSvg = `
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
        `;

        compassArrow = L.marker([lat, lng], {
          icon: L.divIcon({
            className: 'compass-arrow',
            html: arrowSvg,
            iconSize: [40, 40],
            iconAnchor: [20, 20]
          })
        }).addTo(map);
      };

      const updateCompassHeading = (heading: number) => {
        if (compassArrow) {
          const pos = compassArrow.getLatLng();
          createCompassArrow(pos.lat, pos.lng, heading);
        }
      };

      const readCompassHeading = (event: DeviceOrientationEvent): number | null => {
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

        // Relative alpha (common default) is not a compass heading — ignore it.
        return null;
      };

      const stopOrientationWatch = () => {
        if (orientationHandler) {
          window.removeEventListener('deviceorientation', orientationHandler);
          window.removeEventListener(
            'deviceorientationabsolute',
            orientationHandler as EventListener,
          );
          orientationHandler = null;
        }
      };

      const startOrientationWatch = () => {
        if (orientationHandler || !('DeviceOrientationEvent' in window)) {
          return;
        }

        orientationHandler = (event: DeviceOrientationEvent) => {
          const heading = readCompassHeading(event);
          if (heading !== null) {
            updateCompassHeading(heading);
          }
        };

        const attach = () => {
          if (!orientationHandler) return;

          // Chrome/Android: absolute event is north-referenced when available.
          if ('ondeviceorientationabsolute' in window) {
            window.addEventListener(
              'deviceorientationabsolute',
              orientationHandler as EventListener,
            );
          }
          // iOS Safari (webkitCompassHeading) and other browsers.
          window.addEventListener('deviceorientation', orientationHandler);
        };

        if (typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
          (DeviceOrientationEvent as any).requestPermission().then((permission: string) => {
            if (permission === 'granted') {
              attach();
            }
          });
        } else {
          attach();
        }
      };

      const stopLocationWatch = () => {
        if (watchId !== null) {
          navigator.geolocation.clearWatch(watchId);
          watchId = null;
        }
      };

      const clearLayers = () => {
        if (locationCircle) {
          try {
            map.removeLayer(locationCircle);
          } catch {
            // Map may already be tearing down.
          }
          locationCircle = null;
        }
        if (compassArrow) {
          try {
            map.removeLayer(compassArrow);
          } catch {
            // Map may already be tearing down.
          }
          compassArrow = null;
        }
      };

      const stopTrackingResources = () => {
        stopLocationWatch();
        stopOrientationWatch();
        clearLayers();
        lastLat = null;
        lastLng = null;
      };

      const centerOnMyLocation = () => {
        if (lastLat === null || lastLng === null) return;
        map.setView([lastLat, lastLng], Math.max(map.getZoom(), 15));
      };

      const startWatchingLocation = (centerOnFirstFix: boolean) => {
        if (watchId !== null) {
          centerOnMyLocation();
          return;
        }

        if (!navigator.geolocation) {
          trackingEnabled = false;
          button.innerHTML = locationErrorIconHtml;
          button.title = 'Geolocation not supported';
          setTimeout(() => {
            button.innerHTML = locationOffIconHtml;
            button.title = 'Show My Location';
          }, 3000);
          return;
        }

        trackingEnabled = true;
        centerOnNextFix = centerOnFirstFix;
        button.innerHTML = locationLoadingIconHtml;
        button.title = 'Getting location...';

        watchId = navigator.geolocation.watchPosition(
          (position) => {
            const { latitude, longitude } = position.coords;
            const accuracy = position.coords.accuracy;
            const heading = position.coords.heading || 0;
            const shouldCenter = centerOnNextFix;

            centerOnNextFix = false;
            lastLat = latitude;
            lastLng = longitude;

            clearLayers();

            locationCircle = L.circle([latitude, longitude], {
              radius: accuracy,
              color: '#3388ff',
              fillColor: '#3388ff',
              fillOpacity: 0.2,
              weight: 1
            }).addTo(map);

            createCompassArrow(latitude, longitude, heading);
            startOrientationWatch();

            if (shouldCenter) {
              map.setView([latitude, longitude], Math.max(map.getZoom(), 15));
            }

            button.innerHTML = locationOnIconHtml;
            button.title = 'Center on my location';
          },
          (error) => {
            console.error('Error getting location:', error);
            trackingEnabled = false;
            stopTrackingResources();
            button.innerHTML = locationErrorIconHtml;
            button.title = 'Location access denied';
            setTimeout(() => {
              button.innerHTML = locationOffIconHtml;
              button.title = 'Show My Location';
            }, 3000);
          },
          {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 60000
          }
        );
      };

      const created = createControlButton({
        className: 'leaflet-control-location',
        title: 'Show My Location',
        html: locationOffIconHtml,
        onClick: () => startWatchingLocation(true),
      });
      button = created.button;

      if (trackingEnabled) {
        startWatchingLocation(false);
      }

      this._stopTrackingResources = stopTrackingResources;

      return created.container;
    },

    onRemove: function(this: LocationControlInstance) {
      // Stop GPS for this map instance; trackingEnabled keeps the intent
      // so the next Map visit can turn it back on.
      if (typeof this._stopTrackingResources === 'function') {
        this._stopTrackingResources();
        this._stopTrackingResources = null;
      }
    }
  });
};
