import { afterEach, describe, expect, it, vi } from 'vitest';
import type { LatLng, Sector } from '../../types';
import {
  createSectorGeoEditor,
  type SectorGeoEditHost,
  type SectorGeoEditor,
} from './sectorGeoEditor';

const ORIGIN: LatLng = { lat: 42.5, lon: 45.25 };

function sectorAt(geo: LatLng, version = 2): Sector {
  return {
    id: 'sector-1',
    name: 'Shaumian',
    version,
    geo,
    routes: [],
    images: [],
  };
}

function createHost(inView = true) {
  return {
    setEditing: vi.fn(),
    setDragging: vi.fn(),
    setLatLng: vi.fn(),
    isInView: vi.fn(() => inView),
    centerOn: vi.fn(),
    hidePopup: vi.fn(),
    showPopup: vi.fn(),
    save: vi.fn(async (geo: LatLng) => sectorAt(geo, 3)),
  } satisfies SectorGeoEditHost;
}

describe('createSectorGeoEditor', () => {
  const editors: SectorGeoEditor[] = [];

  function editorFor(host: SectorGeoEditHost, geo: LatLng = ORIGIN) {
    const editor = createSectorGeoEditor({ geo, host });
    editors.push(editor);
    return editor;
  }

  afterEach(() => {
    for (const editor of editors) editor.dispose();
    editors.length = 0;
  });

  it('moves the marker from typed coordinates only when the draft is committed', () => {
    const host = createHost();
    const editor = editorFor(host);
    editor.startEdit();
    editor.setLatText('43');
    expect(host.setLatLng).not.toHaveBeenCalled();

    editor.commitDraft();

    expect(host.setLatLng).toHaveBeenCalledWith({ lat: 43, lon: ORIGIN.lon });
    expect(host.centerOn).not.toHaveBeenCalled();
    expect(editor.getSnapshot().latText).toBe('43.000000');
  });

  it('centers the map when a committed point is outside the view', () => {
    const host = createHost(false);
    const editor = editorFor(host);
    editor.startEdit();
    editor.setLonText('10');
    editor.commitDraft();

    expect(host.setLatLng).toHaveBeenCalledWith({ lat: ORIGIN.lat, lon: 10 });
    expect(host.centerOn).toHaveBeenCalledWith({ lat: ORIGIN.lat, lon: 10 });
  });

  it('keeps the marker in place when a committed coordinate is invalid', () => {
    const host = createHost();
    const editor = editorFor(host);
    editor.startEdit();
    editor.setLatText('nope');
    editor.commitDraft();

    expect(host.setLatLng).not.toHaveBeenCalled();
    expect(editor.getSnapshot().latError).toBe('Latitude must be a number from -90 to 90.');
    expect(editor.getSnapshot().editing).toBe(true);
  });

  it('updates the fields from a drag and hides the popup until the drop', () => {
    const host = createHost();
    const editor = editorFor(host);
    editor.startEdit();
    host.setLatLng.mockClear();

    editor.beginDrag();
    editor.moveTo({ lat: 11.2, lon: 3.4 });
    editor.endDrag({ lat: 11.25, lon: 3.5 });

    expect(host.hidePopup).toHaveBeenCalledTimes(1);
    expect(host.showPopup).toHaveBeenCalledTimes(1);
    expect(host.setLatLng).not.toHaveBeenCalled();
    expect(editor.getSnapshot()).toMatchObject({
      editing: true,
      latText: '11.250000',
      lonText: '3.500000',
    });
  });

  it('cancels back to the original point and centers it when that point is off screen', () => {
    const host = createHost(false);
    const editor = editorFor(host);
    editor.startEdit();
    editor.setLatText('12');
    editor.commitDraft();
    host.setLatLng.mockClear();
    host.centerOn.mockClear();

    editor.cancel();

    expect(host.setLatLng).toHaveBeenCalledWith(ORIGIN);
    expect(host.centerOn).toHaveBeenCalledWith(ORIGIN);
    expect(host.setDragging).toHaveBeenLastCalledWith(false);
    expect(host.setEditing).toHaveBeenLastCalledWith(false);
    expect(editor.getSnapshot().editing).toBe(false);
    expect(editor.getSnapshot().latText).toBe('42.500000');
  });

  it('reverts without panning the map when the edit is dismissed', () => {
    const host = createHost(false);
    const editor = editorFor(host);
    editor.startEdit();
    editor.setLatText('12');
    editor.commitDraft();
    host.centerOn.mockClear();

    editor.dismiss();

    expect(host.setLatLng).toHaveBeenLastCalledWith(ORIGIN);
    expect(host.centerOn).not.toHaveBeenCalled();
    expect(editor.getSnapshot().editing).toBe(false);
  });

  it('keeps editing when the popup closes because a drag started', () => {
    const host = createHost();
    const editor = editorFor(host);
    editor.startEdit();
    editor.beginDrag();

    editor.dismiss();
    expect(editor.getSnapshot().editing).toBe(true);

    editor.endDrag({ lat: 11, lon: 3 });
    editor.dismiss();
    expect(editor.getSnapshot().editing).toBe(false);
  });

  it('ignores a dismiss while the save is in flight', () => {
    const host = createHost();
    host.save.mockReturnValue(new Promise<Sector>(() => {}));
    const editor = editorFor(host);
    editor.startEdit();
    editor.setLatText('43');
    editor.apply();

    editor.dismiss();

    expect(editor.getSnapshot()).toMatchObject({ editing: true, saving: true });
  });

  it('lets only one sector pin be edited at a time', () => {
    const firstHost = createHost();
    const secondHost = createHost();
    const first = editorFor(firstHost, { lat: 1, lon: 2 });
    const second = editorFor(secondHost, { lat: 3, lon: 4 });
    first.startEdit();
    first.setLatText('10');
    first.commitDraft();

    second.startEdit();

    expect(first.getSnapshot().editing).toBe(false);
    expect(firstHost.setLatLng).toHaveBeenLastCalledWith({ lat: 1, lon: 2 });
    expect(second.getSnapshot().editing).toBe(true);
    expect(secondHost.setDragging).toHaveBeenCalledWith(true);
  });

  it('leaves edit mode without a request when the point did not change', () => {
    const host = createHost();
    const editor = editorFor(host);
    editor.startEdit();
    editor.setLatText('42.5');
    editor.apply();

    expect(host.save).not.toHaveBeenCalled();
    expect(editor.getSnapshot().editing).toBe(false);
  });

  it('saves a moved point and leaves edit mode', async () => {
    const host = createHost();
    const editor = editorFor(host);
    editor.startEdit();
    editor.setLatText('43');
    editor.apply();

    expect(host.save).toHaveBeenCalledWith({ lat: 43, lon: ORIGIN.lon });
    await host.save.mock.results[0]?.value;
    expect(editor.getSnapshot().editing).toBe(false);
    expect(editor.getSnapshot().latText).toBe('43.000000');
    expect(host.setDragging).toHaveBeenLastCalledWith(false);
  });

  it('stays in edit mode and reports a failed save', async () => {
    const host = createHost();
    host.save.mockRejectedValue(new Error('This sector was updated somewhere else.'));
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const editor = editorFor(host);
    editor.startEdit();
    editor.setLatText('43');
    editor.apply();

    await host.save.mock.results[0]?.value.catch(() => undefined);
    expect(editor.getSnapshot().editing).toBe(true);
    expect(editor.getSnapshot().saving).toBe(false);
    expect(editor.getSnapshot().saveError).toBe('This sector was updated somewhere else.');
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('does not move a removed marker when its editor is disposed', () => {
    const host = createHost();
    const editor = editorFor(host);
    editor.startEdit();
    editor.setLatText('12');
    editor.commitDraft();
    host.setLatLng.mockClear();

    editor.dispose();

    expect(host.setLatLng).not.toHaveBeenCalled();
    const other = editorFor(createHost(), { lat: 5, lon: 6 });
    other.startEdit();
    expect(other.getSnapshot().editing).toBe(true);
  });
});
