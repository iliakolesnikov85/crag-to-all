import { act, renderHook } from '@testing-library/react';
import * as L from 'leaflet';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useLocationTracking } from './useLocationTracking';

function position(lat: number, lon: number): GeolocationPosition {
  return {
    coords: {
      latitude: lat,
      longitude: lon,
      accuracy: 12,
      altitude: null,
      altitudeAccuracy: null,
      heading: null,
      speed: null,
      toJSON() { return {}; },
    },
    timestamp: 0,
    toJSON() { return {}; },
  };
}

function installGeolocation(
  watchPosition: Geolocation['watchPosition'],
  clearWatch: Geolocation['clearWatch'] = () => {},
): void {
  Object.defineProperty(navigator, 'geolocation', {
    configurable: true,
    value: { watchPosition, clearWatch },
  });
}

/** Tracking is remembered for the page session. A missing geolocation clears that flag. */
function clearTrackingFlag(): void {
  Object.defineProperty(navigator, 'geolocation', {
    configurable: true,
    value: undefined,
  });
  const node = document.createElement('div');
  document.body.appendChild(node);
  const map = L.map(node).setView([0, 0], 14);
  const hook = renderHook(() => useLocationTracking(map));
  hook.unmount();
  map.remove();
  node.remove();
}

describe('useLocationTracking', () => {
  let container: HTMLDivElement;
  let map: L.Map;
  let clearWatch: ReturnType<typeof vi.fn>;
  let onSuccess: PositionCallback;
  let unmountHook: (() => void) | null = null;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    map = L.map(container).setView([42.5, 45.2], 14);
    clearWatch = vi.fn();
    onSuccess = () => {};
    unmountHook = null;
    installGeolocation((success) => {
      onSuccess = success;
      return 7;
    }, clearWatch);
  });

  afterEach(() => {
    unmountHook?.();
    const node = map.getContainer() as HTMLElement & { _leaflet_id?: number };
    if (node._leaflet_id != null) map.remove();
    container.remove();
    clearTrackingFlag();
  });

  it('drops a GPS fix that arrives after the map is removed', () => {
    const hook = renderHook(() => useLocationTracking(map));
    unmountHook = hook.unmount;
    act(() => hook.result.current.start());
    act(() => onSuccess(position(42.5, 45.2)));
    expect(container.querySelector('.compass-arrow')).not.toBeNull();

    act(() => {
      map.remove();
    });
    expect(clearWatch).toHaveBeenCalledWith(7);

    const replacement = L.map(container).setView([42.5, 45.2], 14);
    expect(() => {
      act(() => onSuccess(position(1, 2)));
    }).not.toThrow();
    expect(replacement.getContainer().querySelector('.compass-arrow')).toBeNull();
    replacement.remove();
  });
});
