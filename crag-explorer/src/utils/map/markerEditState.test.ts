import { describe, expect, it } from 'vitest';
import type { LatLng } from '../../types';
import {
  DRAFT_MARKER_KEY,
  prepareMarkerSave,
  reduceMarkerEdit,
  startMarkerEdit,
  type MarkerEditAction,
  type MarkerEditState,
} from './markerEditState';

const ORIGIN: LatLng = { lat: 42.5, lon: 45.25 };

function editing(): MarkerEditState {
  return startMarkerEdit('0', ORIGIN, 'parking_space', 'Lot A', false);
}

function run(state: MarkerEditState | null, ...actions: MarkerEditAction[]): MarkerEditState | null {
  return actions.reduce(reduceMarkerEdit, state);
}

describe('reduceMarkerEdit', () => {
  it('starts with the formatted coordinates, type, and info', () => {
    expect(editing()).toMatchObject({
      target: '0',
      markerType: 'parking_space',
      infoText: 'Lot A',
      latText: '42.500000',
      lonText: '45.250000',
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

  it('keeps the chosen type and info', () => {
    const state = run(
      editing(),
      { type: 'setType', value: 'wc' },
      { type: 'setInfoText', value: 'By the barn' },
    );
    expect(state).toMatchObject({ markerType: 'wc', infoText: 'By the barn', infoError: null });
  });

  it('ignores a dismiss while dragging, but not after the drop', () => {
    const dragging = run(editing(), { type: 'beginDrag' });
    expect(run(dragging, { type: 'dismiss' })).toBe(dragging);
    expect(run(dragging, { type: 'endDrag', geo: ORIGIN }, { type: 'dismiss' })).toBeNull();
  });
});

describe('prepareMarkerSave', () => {
  it('reports unchanged when the point, type, and info did not change', () => {
    expect(prepareMarkerSave(editing())).toEqual({ kind: 'unchanged' });
    expect(prepareMarkerSave(run(editing(), { type: 'setInfoText', value: '  Lot A  ' })!)).toEqual({
      kind: 'unchanged',
    });
  });

  it('sends a moved point with the same type and info', () => {
    const state = run(editing(), { type: 'setLatText', value: '43' })!;
    expect(prepareMarkerSave(state)).toEqual({
      kind: 'save',
      marker: { type: 'parking_space', info: 'Lot A', geo: { lat: 43, lon: ORIGIN.lon } },
    });
  });

  it('sends a new type and trimmed info', () => {
    const state = run(
      editing(),
      { type: 'setType', value: 'water_tap' },
      { type: 'setInfoText', value: ' Spring ' },
    )!;
    expect(prepareMarkerSave(state)).toMatchObject({
      kind: 'save',
      marker: { type: 'water_tap', info: 'Spring', geo: ORIGIN },
    });
  });

  it('rejects an invalid coordinate and info that is too long', () => {
    const state = run(
      editing(),
      { type: 'setLatText', value: 'x' },
      { type: 'setInfoText', value: 'a'.repeat(2001) },
    )!;
    const result = prepareMarkerSave(state);
    expect(result.kind).toBe('invalid');
    if (result.kind !== 'invalid') return;
    expect(result.state.latError).toBe('Latitude must be a number from -90 to 90.');
    expect(result.state.infoError).toBe('Info must be at most 2000 characters.');
  });

  it('saves a new marker even when the point was not moved', () => {
    const draft = startMarkerEdit(DRAFT_MARKER_KEY, ORIGIN, 'camping', '', true);
    expect(prepareMarkerSave(draft)).toEqual({
      kind: 'save',
      marker: { type: 'camping', info: '', geo: ORIGIN },
    });
  });
});
