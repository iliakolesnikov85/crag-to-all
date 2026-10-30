import * as L from 'leaflet';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { LatLng, Sector } from '../../types';
import { addDraftSectorMarker, type DraftSectorMarkerOptions, type NewSectorInput } from './draftSectorMarker';

vi.mock('../../components/map/SectorMapInfo', () => ({
  renderSectorMapInfo: vi.fn(),
}));

const GEO: LatLng = { lat: 42.5, lon: 45.2 };

function createdSector(input: NewSectorInput): Sector {
  return { id: 'new-1', version: 1, routes: [], images: [], ...input };
}

describe('addDraftSectorMarker', () => {
  let map: L.Map;
  let container: HTMLDivElement;

  function markersOnMap(): L.Marker[] {
    const markers: L.Marker[] = [];
    map.eachLayer((layer) => {
      if (layer instanceof L.Marker) markers.push(layer);
    });
    return markers;
  }

  function addDraft(overrides: Partial<DraftSectorMarkerOptions> = {}) {
    const options = {
      map,
      geo: GEO,
      mode: 'popup' as const,
      takenNames: ['Cave'],
      cragContext: { crag: { cragId: 'test', cragName: 'Test' }, getUrl: (url: string) => url },
      navigate: vi.fn(),
      createSector: vi.fn(async (input: NewSectorInput) => createdSector(input)),
      onCreated: vi.fn(),
      onClose: vi.fn(),
      ...overrides,
    };
    return { draft: addDraftSectorMarker(options), options };
  }

  beforeEach(() => {
    vi.useFakeTimers();
    container = document.createElement('div');
    document.body.appendChild(container);
    map = L.map(container).setView([GEO.lat, GEO.lon], 14);
  });

  afterEach(() => {
    map.remove();
    container.remove();
    vi.useRealTimers();
  });

  it('adds an editable marker with its popup open', () => {
    const { draft } = addDraft();
    const [marker] = markersOnMap();

    expect(marker?.getLatLng()).toMatchObject({ lat: GEO.lat, lng: GEO.lon });
    expect(marker?.isPopupOpen()).toBe(true);
    expect(marker?.getElement()?.classList.contains('custom-marker--editing')).toBe(true);
    expect(draft.editor.getSnapshot()).toMatchObject({ editing: true, nameText: '' });
  });

  it('removes the marker on cancel', () => {
    const { draft, options } = addDraft();
    draft.editor.cancel();

    expect(markersOnMap()).toHaveLength(0);
    expect(options.onClose).toHaveBeenCalledTimes(1);
    expect(options.createSector).not.toHaveBeenCalled();
  });

  it('removes the marker when its popup closes', () => {
    const { options } = addDraft();
    map.closePopup();
    vi.runAllTimers();

    expect(markersOnMap()).toHaveLength(0);
    expect(options.onClose).toHaveBeenCalledTimes(1);
  });

  it('creates the sector on save, then removes the draft marker', async () => {
    const createSector = vi.fn(async (input: NewSectorInput) => createdSector(input));
    const { draft, options } = addDraft({ createSector });
    draft.editor.setNameText('North Wall');
    draft.editor.apply();
    await createSector.mock.results[0]?.value;
    await Promise.resolve();

    expect(createSector).toHaveBeenCalledWith({ name: 'North Wall', geo: GEO });
    expect(options.onCreated).toHaveBeenCalledWith(
      createdSector({ name: 'North Wall', geo: GEO }),
    );
    expect(markersOnMap()).toHaveLength(0);
    expect(options.onClose).toHaveBeenCalledTimes(1);
  });

  it('keeps the draft and shows the error when the save fails', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const createSector = vi.fn(async () => {
      throw new Error('A sector with this name already exists.');
    });
    const { draft, options } = addDraft({ createSector });
    draft.editor.setNameText('North Wall');
    draft.editor.apply();
    await expect(createSector.mock.results[0]?.value).rejects.toThrow();
    await Promise.resolve();

    expect(draft.editor.getSnapshot()).toMatchObject({
      editing: true,
      saving: false,
      saveError: 'A sector with this name already exists.',
    });
    expect(markersOnMap()).toHaveLength(1);
    expect(options.onCreated).not.toHaveBeenCalled();
    expect(options.onClose).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('does not open a popup in bottom-panel mode', () => {
    const { draft } = addDraft({ mode: 'bottom-panel' });
    const [marker] = markersOnMap();

    expect(marker?.getPopup()).toBeUndefined();
    expect(draft.editor.getSnapshot().editing).toBe(true);
  });

  it('keeps the draft when the pin is tapped in bottom-panel mode', () => {
    const { draft } = addDraft({ mode: 'bottom-panel' });
    const [marker] = markersOnMap();
    const onMapClick = vi.fn();
    map.on('click', onMapClick);

    marker?.getElement()?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(onMapClick).not.toHaveBeenCalled();
    expect(markersOnMap()).toHaveLength(1);
    expect(draft.editor.getSnapshot().editing).toBe(true);

    map.getContainer().dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(onMapClick).toHaveBeenCalledTimes(1);
  });

  it('closes once when removed from outside', () => {
    const { draft, options } = addDraft();
    draft.remove();
    draft.remove();

    expect(markersOnMap()).toHaveLength(0);
    expect(options.onClose).toHaveBeenCalledTimes(1);
  });
});
