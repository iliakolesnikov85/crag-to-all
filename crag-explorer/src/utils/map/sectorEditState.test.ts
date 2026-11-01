import { describe, expect, it } from 'vitest';
import type { LatLng } from '../../types';
import {
  DRAFT_SECTOR_ID,
  prepareSectorSave,
  reduceSectorEdit,
  sectorMarkerKey,
  startSectorEdit,
  type SectorEditAction,
  type SectorEditState,
} from './sectorEditState';

const ORIGIN: LatLng = { lat: 42.5, lon: 45.25 };

function editing(): SectorEditState {
  return startSectorEdit('sector-1', ORIGIN, 'Shaumian', false);
}

function run(state: SectorEditState | null, ...actions: SectorEditAction[]): SectorEditState | null {
  return actions.reduce(reduceSectorEdit, state);
}

describe('sectorMarkerKey', () => {
  it('uses the id when present and the name otherwise', () => {
    expect(sectorMarkerKey({ id: 's1', name: 'Cave', geo: null, routes: [], images: [] })).toBe('s1');
    expect(sectorMarkerKey({ name: 'Cave', geo: null, routes: [], images: [] })).toBe('name:Cave');
  });
});

describe('reduceSectorEdit', () => {
  it('starts with the formatted coordinates and the current name', () => {
    expect(editing()).toMatchObject({
      target: 'sector-1',
      saving: false,
      dragging: false,
      latText: '42.500000',
      lonText: '45.250000',
      nameText: 'Shaumian',
      currentGeo: ORIGIN,
    });
  });

  it('moves the pin from typed coordinates only when the draft is committed', () => {
    const typed = run(editing(), { type: 'setLatText', value: '43' });
    expect(typed?.currentGeo).toEqual(ORIGIN);

    const committed = run(typed, { type: 'commitDraft' });
    expect(committed?.currentGeo).toEqual({ lat: 43, lon: ORIGIN.lon });
    expect(committed?.latText).toBe('43.000000');
  });

  it('keeps the pin in place when a committed coordinate is invalid', () => {
    const state = run(editing(), { type: 'setLatText', value: 'nope' }, { type: 'commitDraft' });

    expect(state?.currentGeo).toEqual(ORIGIN);
    expect(state?.latError).toBe('Latitude must be a number from -90 to 90.');
  });

  it('updates the fields from a drag', () => {
    const state = run(
      editing(),
      { type: 'beginDrag' },
      { type: 'moveTo', geo: { lat: 11.2, lon: 3.4 } },
    );
    expect(state).toMatchObject({ dragging: true, latText: '11.200000', lonText: '3.400000' });

    const dropped = run(state, { type: 'endDrag', geo: { lat: 11.25, lon: 3.5 } });
    expect(dropped).toMatchObject({ dragging: false, latText: '11.250000', lonText: '3.500000' });
  });

  it('ends the edit on cancel', () => {
    expect(run(editing(), { type: 'setLatText', value: '12' }, { type: 'cancel' })).toBeNull();
  });

  it('ignores a dismiss while dragging, but not after the drop', () => {
    const dragging = run(editing(), { type: 'beginDrag' });
    expect(run(dragging, { type: 'dismiss' })).toBe(dragging);

    const dropped = run(dragging, { type: 'endDrag', geo: { lat: 11, lon: 3 } });
    expect(run(dropped, { type: 'dismiss' })).toBeNull();
  });

  it('ignores field changes, cancel, and dismiss while saving', () => {
    const saving = run(editing(), { type: 'saveStarted', name: 'Shaumian', geo: { lat: 43, lon: 45.25 } });
    expect(saving).toMatchObject({ saving: true, latText: '43.000000' });

    expect(run(saving, { type: 'setLatText', value: '1' })).toBe(saving);
    expect(run(saving, { type: 'cancel' })).toBe(saving);
    expect(run(saving, { type: 'dismiss' })).toBe(saving);
    expect(run(saving, { type: 'start', target: 'other', geo: ORIGIN, name: 'x', isNew: false })).toBe(saving);
  });

  it('stays in edit mode and reports a failed save', () => {
    const state = run(
      editing(),
      { type: 'saveStarted', name: 'Shaumian', geo: ORIGIN },
      { type: 'saveFailed', message: 'This sector was updated somewhere else.' },
    );
    expect(state).toMatchObject({
      saving: false,
      saveError: 'This sector was updated somewhere else.',
    });
  });

  it('ends the edit when the save succeeds', () => {
    expect(run(editing(), { type: 'saveStarted', name: 'Shaumian', geo: ORIGIN }, { type: 'saveSucceeded' })).toBeNull();
  });

  it('replaces an edit in progress when another pin starts editing', () => {
    const state = run(editing(), { type: 'start', target: 'sector-2', geo: { lat: 3, lon: 4 }, name: 'Cave', isNew: false });
    expect(state).toMatchObject({ target: 'sector-2', nameText: 'Cave' });
  });

  it('keeps the chosen topo on the draft', () => {
    const file = new File(['topo'], 'topo.jpg', { type: 'image/jpeg' });
    const state = run(
      startSectorEdit(DRAFT_SECTOR_ID, ORIGIN, '', true),
      { type: 'setTopoFile', file },
    );
    expect(state?.topoFile).toBe(file);
  });
});

describe('prepareSectorSave', () => {
  it('reports unchanged when the point and the name did not change', () => {
    expect(prepareSectorSave(run(editing(), { type: 'setLatText', value: '42.5' })!, [])).toEqual({ kind: 'unchanged' });
    expect(prepareSectorSave(run(editing(), { type: 'setNameText', value: '  Shaumian  ' })!, [])).toEqual({ kind: 'unchanged' });
  });

  it('sends only the moved point', () => {
    const result = prepareSectorSave(run(editing(), { type: 'setLatText', value: '43' })!, []);
    expect(result).toMatchObject({ kind: 'save', patch: { geo: { lat: 43, lon: ORIGIN.lon } } });
    expect((result as { patch: object }).patch).not.toHaveProperty('name');
  });

  it('sends only the trimmed new name', () => {
    const result = prepareSectorSave(run(editing(), { type: 'setNameText', value: ' North Wall ' })!, []);
    expect(result).toMatchObject({ kind: 'save', patch: { name: 'North Wall' } });
    expect((result as { patch: object }).patch).not.toHaveProperty('geo');
  });

  it('sends a new name and a moved point together', () => {
    const state = run(editing(), { type: 'setNameText', value: 'North Wall' }, { type: 'setLatText', value: '43' })!;
    expect(prepareSectorSave(state, [])).toMatchObject({
      kind: 'save',
      patch: { name: 'North Wall', geo: { lat: 43, lon: ORIGIN.lon } },
    });
  });

  it('rejects an empty name and an invalid coordinate without saving', () => {
    const state = run(editing(), { type: 'setNameText', value: '  ' }, { type: 'setLatText', value: 'x' })!;
    const result = prepareSectorSave(state, []);
    expect(result.kind).toBe('invalid');
    if (result.kind !== 'invalid') return;
    expect(result.state.nameError).toBe('Enter a sector name.');
    expect(result.state.latError).toBe('Latitude must be a number from -90 to 90.');
  });

  it('rejects a name another sector already uses, ignoring case', () => {
    const state = run(editing(), { type: 'setNameText', value: 'cave' })!;
    expect(prepareSectorSave(state, ['Cave'])).toMatchObject({
      kind: 'invalid',
      state: { nameError: 'A sector with this name already exists.' },
    });
  });

  describe('new sector', () => {
    function draft(): SectorEditState {
      return startSectorEdit(DRAFT_SECTOR_ID, ORIGIN, '', true);
    }

    it('sends the name and the unchanged point', () => {
      const state = run(draft(), { type: 'setNameText', value: 'North Wall' })!;
      expect(prepareSectorSave(state, [])).toMatchObject({
        kind: 'save',
        patch: { name: 'North Wall', geo: ORIGIN },
      });
    });

    it('requires a name', () => {
      expect(prepareSectorSave(draft(), [])).toMatchObject({
        kind: 'invalid',
        state: { nameError: 'Enter a sector name.' },
      });
    });

    it('rejects a name that another sector already uses', () => {
      const state = run(draft(), { type: 'setNameText', value: 'Shaumian' })!;
      expect(prepareSectorSave(state, ['Shaumian']).kind).toBe('invalid');
    });
  });
});
