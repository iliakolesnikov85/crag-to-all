import * as L from 'leaflet';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CRAG_DATA_PROTOCOL, type CragData, type Sector } from '../../types';
import { renderMapOverlays } from './mapOverlays';
import type { SectorEditPatch, SectorGeoEditor } from './sectorGeoEditor';

vi.mock('../../components/SectorMapInfo', () => ({
  renderSectorMapInfo: vi.fn(),
}));

const SECTOR: Sector = {
  id: 's1',
  name: 'Cave',
  version: 1,
  geo: { lat: 42.5, lon: 45.2 },
  routes: [],
  images: [],
};

const CRAG_DATA: CragData = {
  protocolVersion: CRAG_DATA_PROTOCOL,
  name: 'Test',
  description: [],
  sectors: [SECTOR],
};

describe('renderMapOverlays sector popup', () => {
  let map: L.Map;
  let container: HTMLDivElement;

  function renderEditableSector(): { marker: L.Marker; editor: SectorGeoEditor } {
    const overlay = L.layerGroup().addTo(map);
    const editors = new Map<string, SectorGeoEditor>();
    renderMapOverlays(overlay, CRAG_DATA, vi.fn(), {
      mode: 'popup',
      cragContext: { crag: { cragId: 'test', cragName: 'Test' }, getUrl: (url) => url },
      map,
      canEditSectorGeo: true,
      editors,
      saveSectorGeo: vi.fn(async (sector: Sector) => sector),
    });
    const marker = overlay.getLayers()[0] as L.Marker;
    const editor = editors.get('s1');
    if (!editor) throw new Error('expected an editor for the sector');
    return { marker, editor };
  }

  beforeEach(() => {
    vi.useFakeTimers();
    container = document.createElement('div');
    document.body.appendChild(container);
    map = L.map(container).setView([42.5, 45.2], 14);
  });

  afterEach(() => {
    map.remove();
    container.remove();
    vi.useRealTimers();
  });

  it('keeps editing when a quick drag ends before the close timer runs', () => {
    const { marker, editor } = renderEditableSector();
    editor.startEdit();

    marker.fire('popupclose');
    marker.fire('dragstart');
    marker.fire('dragend');
    vi.runAllTimers();

    expect(editor.getSnapshot().editing).toBe(true);
  });

  it('ends the edit when the popup closes without a drag', () => {
    const { marker, editor } = renderEditableSector();
    editor.startEdit();

    marker.fire('popupclose');
    vi.runAllTimers();

    expect(editor.getSnapshot().editing).toBe(false);
  });

  it('keeps editing when a coordinate move outside the view closes the popup', () => {
    const { marker, editor } = renderEditableSector();
    const panTo = vi.spyOn(map, 'panTo');
    editor.startEdit();
    editor.setLonText('10');
    editor.commitDraft();

    expect(panTo).toHaveBeenCalledWith(expect.anything(), { animate: false });
    expect(marker.getLatLng().lng).toBe(10);

    marker.fire('popupclose');
    vi.runAllTimers();

    expect(editor.getSnapshot().editing).toBe(true);
    expect(marker.getLatLng().lng).toBe(10);
  });

  it('ends the edit when the popup closes after the coordinate move settles', () => {
    const { marker, editor } = renderEditableSector();
    editor.startEdit();
    editor.setLonText('10');
    editor.commitDraft();
    vi.runAllTimers();

    marker.fire('popupclose');
    vi.runAllTimers();

    expect(editor.getSnapshot().editing).toBe(false);
  });

  it('updates the pin label after a rename', async () => {
    const overlay = L.layerGroup().addTo(map);
    const editors = new Map<string, SectorGeoEditor>();
    const saveSectorGeo = vi.fn(async (sector: Sector, patch: SectorEditPatch) => ({
      ...sector,
      name: patch.name ?? sector.name,
      geo: patch.geo ?? sector.geo,
      version: 2,
    }));
    renderMapOverlays(overlay, CRAG_DATA, vi.fn(), {
      mode: 'popup',
      cragContext: { crag: { cragId: 'test', cragName: 'Test' }, getUrl: (url) => url },
      map,
      canEditSectorGeo: true,
      editors,
      saveSectorGeo,
    });
    const marker = overlay.getLayers()[0] as L.Marker;
    const editor = editors.get('s1');
    if (!editor) throw new Error('expected an editor for the sector');

    expect(marker.getElement()?.querySelector('.label')?.textContent).toBe('Cave');
    editor.startEdit();
    editor.setNameText('North Wall');
    editor.apply();
    await saveSectorGeo.mock.results[0]?.value;
    await Promise.resolve();

    expect(saveSectorGeo).toHaveBeenCalledWith(SECTOR, { name: 'North Wall' });
    expect(marker.getElement()?.querySelector('.label')?.textContent).toBe('North Wall');
  });
});
