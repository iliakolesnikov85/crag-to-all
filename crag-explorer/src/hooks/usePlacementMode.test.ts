import * as L from 'leaflet';
import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { usePlacementMode } from './usePlacementMode';

describe('usePlacementMode', () => {
  let map: L.Map;
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    map = L.map(container).setView([42.5, 45.2], 14);
  });

  afterEach(() => {
    map.remove();
    container.remove();
  });

  function fireMapClick(target: EventTarget, lat = 42.5, lon = 45.2) {
    map.fire('click', {
      latlng: L.latLng(lat, lon),
      originalEvent: { target } as unknown as Event,
    });
  }

  it('waits until after the activating click before placing, and ignores control clicks', async () => {
    const onPlace = vi.fn();
    const onCancel = vi.fn();
    const hook = renderHook(
      ({ active }: { active: boolean }) => usePlacementMode(map, active, { onPlace, onCancel }),
      { initialProps: { active: false } },
    );

    const control = L.DomUtil.create('div', 'leaflet-control', map.getContainer());
    hook.rerender({ active: true });

    fireMapClick(map.getContainer(), 1, 2);
    expect(onPlace).not.toHaveBeenCalled();

    await new Promise((resolve) => window.setTimeout(resolve, 0));

    fireMapClick(control, 1, 2);
    expect(onPlace).not.toHaveBeenCalled();

    fireMapClick(map.getContainer(), 3, 4);
    expect(onPlace).toHaveBeenCalledWith({ lat: 3, lon: 4 });
  });

  it('cancels on Escape without waiting', () => {
    const onPlace = vi.fn();
    const onCancel = vi.fn();
    renderHook(() => usePlacementMode(map, true, { onPlace, onCancel }));

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onPlace).not.toHaveBeenCalled();
  });
});
