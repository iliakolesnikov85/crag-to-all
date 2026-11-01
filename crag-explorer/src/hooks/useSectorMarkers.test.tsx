import { renderHook } from '@testing-library/react';
import * as L from 'leaflet';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Sector } from '../types';
import { useSectorMarkers, type SectorMarkerCallbacks, type SectorMarkerEdit } from './useSectorMarkers';

const CAVE: Sector = { id: 's1', name: 'Cave', version: 1, geo: { lat: 42.5, lon: 45.2 }, routes: [], images: [] };
const WALL: Sector = { id: 's2', name: 'Wall', version: 1, geo: { lat: 42.6, lon: 45.3 }, routes: [], images: [] };
const NO_GEO: Sector = { id: 's3', name: 'Lost', version: 1, geo: null, routes: [], images: [] };

describe('useSectorMarkers', () => {
  let map: L.Map;
  let container: HTMLDivElement;
  let callbacks: SectorMarkerCallbacks;

  function markersOnMap(): L.Marker[] {
    const markers: L.Marker[] = [];
    map.eachLayer((layer) => {
      if (layer instanceof L.Marker) markers.push(layer);
    });
    return markers;
  }

  function labels(): string[] {
    return markersOnMap()
      .map((marker) => marker.getElement()?.querySelector('.label')?.textContent ?? '')
      .sort();
  }

  function setup(sectors: readonly Sector[], edit: SectorMarkerEdit | null = null) {
    return renderHook(
      (props: { sectors: readonly Sector[]; edit: SectorMarkerEdit | null }) =>
        useSectorMarkers(map, props.sectors, props.edit, callbacks),
      { initialProps: { sectors, edit } },
    );
  }

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    map = L.map(container).setView([42.5, 45.2], 14);
    callbacks = {
      onSelect: vi.fn(),
      onDragStart: vi.fn(),
      onDrag: vi.fn(),
      onDragEnd: vi.fn(),
    };
  });

  afterEach(() => {
    map.remove();
    container.remove();
  });

  it('adds a marker per sector with a location and removes markers that are gone', () => {
    const hook = setup([CAVE, WALL, NO_GEO]);
    expect(labels()).toEqual(['Cave', 'Wall']);

    hook.rerender({ sectors: [WALL], edit: null });
    expect(labels()).toEqual(['Wall']);

    hook.unmount();
    expect(markersOnMap()).toHaveLength(0);
  });

  it('keeps the same marker and updates its label when the sector changes', () => {
    const hook = setup([CAVE]);
    const [before] = markersOnMap();

    hook.rerender({ sectors: [{ ...CAVE, name: 'North Wall', version: 2 }], edit: null });

    const [after] = markersOnMap();
    expect(after).toBe(before);
    expect(labels()).toEqual(['North Wall']);
  });

  it('moves the marker when the saved location changes', () => {
    const hook = setup([CAVE]);
    hook.rerender({ sectors: [{ ...CAVE, geo: { lat: 10, lon: 20 } }], edit: null });

    expect(markersOnMap()[0]?.getLatLng()).toMatchObject({ lat: 10, lng: 20 });
  });

  it('follows the edit position and enables dragging only for the edited marker', () => {
    const hook = setup([CAVE, WALL], { key: 's1', geo: { lat: 1, lon: 2 }, dragging: false });
    const cave = markersOnMap().find((marker) => marker.getLatLng().lat === 1);
    const wall = markersOnMap().find((marker) => marker.getLatLng().lat === 42.6);

    expect(cave?.getLatLng()).toMatchObject({ lat: 1, lng: 2 });
    expect(cave?.dragging?.enabled()).toBe(true);
    expect(cave?.getElement()?.classList.contains('custom-marker--editing')).toBe(true);
    expect(wall?.dragging?.enabled()).toBe(false);
    expect(wall?.getElement()?.classList.contains('custom-marker--editing')).toBe(false);

    hook.rerender({ sectors: [CAVE, WALL], edit: null });
    expect(cave?.getLatLng()).toMatchObject({ lat: 42.5, lng: 45.2 });
    expect(cave?.dragging?.enabled()).toBe(false);
    expect(cave?.getElement()?.classList.contains('custom-marker--editing')).toBe(false);
  });

  it('reports a click without letting it reach the map', () => {
    setup([CAVE]);
    const onMapClick = vi.fn();
    map.on('click', onMapClick);

    markersOnMap()[0]?.getElement()?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(callbacks.onSelect).toHaveBeenCalledWith('s1');
    expect(onMapClick).not.toHaveBeenCalled();
  });

  it('keeps the same icon while an edited pin is dragged to a new object identity', () => {
    const draft: Sector = {
      id: '__draft__',
      name: 'New sector',
      geo: { lat: 1, lon: 2 },
      routes: [],
      images: [],
    };
    const hook = setup([draft], { key: '__draft__', geo: draft.geo!, dragging: false });
    const [before] = markersOnMap();
    const icon = before.getElement();

    hook.rerender({
      sectors: [{ ...draft, geo: { lat: 3, lon: 4 } }],
      edit: { key: '__draft__', geo: { lat: 3, lon: 4 }, dragging: true },
    });

    const [after] = markersOnMap();
    expect(after).toBe(before);
    expect(after.getElement()).toBe(icon);
    expect(after.dragging?.enabled()).toBe(true);
  });

  it('reports drag start, moves, and the drop position', () => {
    setup([CAVE], { key: 's1', geo: CAVE.geo!, dragging: false });
    const [marker] = markersOnMap();

    marker.fire('dragstart');
    expect(callbacks.onDragStart).toHaveBeenCalledTimes(1);
    expect(marker.getElement()?.classList.contains('custom-marker--dragging')).toBe(true);

    marker.setLatLng([5, 6]);
    marker.fire('drag');
    expect(callbacks.onDrag).toHaveBeenCalledWith({ lat: 5, lon: 6 });

    marker.setLatLng([7, 8]);
    marker.fire('dragend');
    expect(callbacks.onDragEnd).toHaveBeenCalledWith({ lat: 7, lon: 8 });
    expect(marker.getElement()?.classList.contains('custom-marker--dragging')).toBe(false);
  });
});
