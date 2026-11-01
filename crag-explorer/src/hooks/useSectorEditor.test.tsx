import { act, renderHook } from '@testing-library/react';
import * as L from 'leaflet';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { LatLng, Sector } from '../types';
import { DRAFT_SECTOR_ID, type SectorEditPatch } from '../utils/map/sectorEditState';
import { useSectorEditor, type NewSectorInput, type UseSectorEditorOptions } from './useSectorEditor';

const ORIGIN: LatLng = { lat: 42.5, lon: 45.25 };

const SECTOR: Sector = {
  id: 'sector-1',
  name: 'Shaumian',
  version: 2,
  geo: ORIGIN,
  routes: [],
  images: [],
};

const OTHER: Sector = {
  id: 'sector-2',
  name: 'Cave',
  version: 1,
  geo: { lat: 3, lon: 4 },
  routes: [],
  images: [],
};

describe('useSectorEditor', () => {
  let map: L.Map;
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    map = L.map(container).setView([ORIGIN.lat, ORIGIN.lon], 14);
  });

  afterEach(() => {
    map.remove();
    container.remove();
  });

  function setup(overrides: Partial<UseSectorEditorOptions> = {}) {
    const options: UseSectorEditorOptions = {
      map,
      sectors: [SECTOR, OTHER],
      saveSector: vi.fn(async (sector: Sector, patch: SectorEditPatch) => ({
        ...sector,
        name: patch.name ?? sector.name,
        geo: patch.geo ?? sector.geo,
        version: 3,
      })),
      createSector: vi.fn(async (input: NewSectorInput) => ({
        id: 'new-1',
        version: 1,
        routes: [],
        images: [],
        ...input,
      })),
      onSaved: vi.fn(),
      onCreated: vi.fn(),
      ...overrides,
    };
    const hook = renderHook(() => useSectorEditor(options));
    const editor = () => hook.result.current;
    return { editor, options, hook };
  }

  it('pans the map when a committed point is outside the view', () => {
    const { editor } = setup();
    const panTo = vi.spyOn(map, 'panTo');
    act(() => editor().startEdit(SECTOR));
    act(() => editor().setLonText('10'));
    act(() => editor().commitDraft());

    expect(editor().state?.currentGeo).toEqual({ lat: ORIGIN.lat, lon: 10 });
    expect(panTo).toHaveBeenCalledWith([ORIGIN.lat, 10], { animate: false });
  });

  it('does not pan when the committed point is still in view', () => {
    const { editor } = setup();
    // jsdom gives the map no size, so its real bounds hold a single point.
    vi.spyOn(map, 'getBounds').mockReturnValue(L.latLngBounds([[40, 40], [45, 50]]));
    const panTo = vi.spyOn(map, 'panTo');
    act(() => editor().startEdit(SECTOR));
    act(() => editor().setLatText('42.5001'));
    act(() => editor().commitDraft());

    expect(panTo).not.toHaveBeenCalled();
  });

  it('cancels back to the original point and recenters it when that point is off screen', () => {
    const { editor } = setup();
    act(() => editor().startEdit(SECTOR));
    act(() => editor().setLatText('12'));
    act(() => editor().commitDraft());
    const panTo = vi.spyOn(map, 'panTo');

    act(() => editor().cancel());

    expect(editor().state).toBeNull();
    expect(panTo).toHaveBeenCalledWith([ORIGIN.lat, ORIGIN.lon], { animate: false });
  });

  it('reverts without panning when the edit is dismissed', () => {
    const { editor } = setup();
    act(() => editor().startEdit(SECTOR));
    act(() => editor().setLatText('12'));
    act(() => editor().commitDraft());
    const panTo = vi.spyOn(map, 'panTo');

    act(() => editor().dismiss());

    expect(editor().state).toBeNull();
    expect(panTo).not.toHaveBeenCalled();
  });

  it('lets only one pin be edited at a time', () => {
    const { editor } = setup();
    act(() => editor().startEdit(SECTOR));
    act(() => editor().startEdit(OTHER));

    expect(editor().state).toMatchObject({ target: 'sector-2', nameText: 'Cave' });
  });

  it('refuses to edit a sector without an id or version', () => {
    const { editor } = setup();
    act(() => editor().startEdit({ ...SECTOR, version: undefined }));
    expect(editor().state).toBeNull();
  });

  it('leaves edit mode without a request when nothing changed', () => {
    const { editor, options } = setup();
    act(() => editor().startEdit(SECTOR));
    act(() => editor().setLatText('42.5'));
    act(() => editor().apply());

    expect(options.saveSector).not.toHaveBeenCalled();
    expect(editor().state).toBeNull();
  });

  it('saves a moved point with the latest sector version and leaves edit mode', async () => {
    const { editor, options } = setup();
    act(() => editor().startEdit(SECTOR));
    act(() => editor().setLatText('43'));
    await act(async () => {
      editor().apply();
    });

    expect(options.saveSector).toHaveBeenCalledWith(SECTOR, { geo: { lat: 43, lon: ORIGIN.lon } });
    expect(options.onSaved).toHaveBeenCalledWith(expect.objectContaining({ version: 3 }));
    expect(editor().state).toBeNull();
  });

  it('stays in edit mode and reports a failed save', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const saveSector = vi.fn(async () => {
      throw new Error('This sector was updated somewhere else.');
    });
    const { editor } = setup({ saveSector });
    act(() => editor().startEdit(SECTOR));
    act(() => editor().setLatText('43'));
    await act(async () => {
      editor().apply();
    });

    expect(editor().state).toMatchObject({
      saving: false,
      saveError: 'This sector was updated somewhere else.',
    });
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('ignores a dismiss while the save is in flight', () => {
    const saveSector = vi.fn(() => new Promise<Sector>(() => {}));
    const { editor } = setup({ saveSector });
    act(() => editor().startEdit(SECTOR));
    act(() => editor().setLatText('43'));
    act(() => editor().apply());
    act(() => editor().dismiss());

    expect(editor().state).toMatchObject({ saving: true });
  });

  it('rejects a name another sector already uses', () => {
    const { editor, options } = setup();
    act(() => editor().startEdit(SECTOR));
    act(() => editor().setNameText('cave'));
    act(() => editor().apply());

    expect(options.saveSector).not.toHaveBeenCalled();
    expect(editor().state?.nameError).toBe('A sector with this name already exists.');
  });

  describe('draft sector', () => {
    it('starts in edit mode with an empty name', () => {
      const { editor } = setup();
      act(() => editor().startDraft(ORIGIN));

      expect(editor().state).toMatchObject({
        target: DRAFT_SECTOR_ID,
        isNew: true,
        nameText: '',
        currentGeo: ORIGIN,
      });
    });

    it('creates the sector on save and reports it', async () => {
      const { editor, options } = setup();
      act(() => editor().startDraft(ORIGIN));
      act(() => editor().setNameText('North Wall'));
      await act(async () => {
        editor().apply();
      });

      expect(options.createSector).toHaveBeenCalledWith({ name: 'North Wall', geo: ORIGIN }, null);
      expect(options.onCreated).toHaveBeenCalledWith(expect.objectContaining({ id: 'new-1', name: 'North Wall' }));
      expect(editor().state).toBeNull();
    });

    it('passes the chosen topo to the create call', async () => {
      const file = new File(['topo'], 'topo.jpg', { type: 'image/jpeg' });
      const { editor, options } = setup();
      act(() => editor().startDraft(ORIGIN));
      act(() => editor().setNameText('North Wall'));
      act(() => editor().setTopoFile(file));
      await act(async () => {
        editor().apply();
      });

      expect(options.createSector).toHaveBeenCalledWith({ name: 'North Wall', geo: ORIGIN }, file);
    });

    it('keeps the draft and the photo when the create fails', async () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const file = new File(['topo'], 'topo.jpg', { type: 'image/jpeg' });
      const createSector = vi.fn(async () => {
        throw new Error('Could not upload image');
      });
      const { editor, options } = setup({ createSector });
      act(() => editor().startDraft(ORIGIN));
      act(() => editor().setNameText('North Wall'));
      act(() => editor().setTopoFile(file));
      await act(async () => {
        editor().apply();
      });

      expect(editor().state).toMatchObject({
        target: DRAFT_SECTOR_ID,
        saving: false,
        saveError: 'Could not upload image',
        topoFile: file,
      });
      expect(options.onCreated).not.toHaveBeenCalled();
      errorSpy.mockRestore();
    });

    it('requires a name before saving', () => {
      const { editor, options } = setup();
      act(() => editor().startDraft(ORIGIN));
      act(() => editor().apply());

      expect(options.createSector).not.toHaveBeenCalled();
      expect(editor().state?.nameError).toBe('Enter a sector name.');
    });
  });
});
