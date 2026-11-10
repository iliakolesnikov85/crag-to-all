import { useCallback, useMemo, useRef, useState } from 'react';
import type * as L from 'leaflet';
import { CRAG_MAP_MARKER_TYPES, type CragMapMarker, type CragMapMarkerType, type LatLng } from '../types';
import {
  DEFAULT_MARKER_TYPE,
  DRAFT_MARKER_KEY,
  markerKeyFromIndex,
  prepareMarkerSave,
  reduceMarkerEdit,
  type MarkerEditAction,
  type MarkerEditState,
} from '../utils/map/markerEditState';

const MISSING_VERSION = 'This crag cannot be saved because it has no version.';

function geoInView(map: L.Map | null, geo: LatLng): boolean {
  if (!map) return true;
  const bounds = map.getBounds();
  if (!bounds.isValid()) return true;
  return bounds.contains([geo.lat, geo.lon]);
}

function panTo(map: L.Map | null, geo: LatLng): void {
  // Jump instead of animating. A pan larger than the screen uses a CSS
  // translate that drops tiles which have not loaded yet.
  map?.panTo([geo.lat, geo.lon], { animate: false });
}

function saveErrorMessage(error: unknown): string {
  return error instanceof Error && error.message.trim() ? error.message : 'Could not save marker';
}

function isMarkerType(value: string): value is CragMapMarkerType {
  return (CRAG_MAP_MARKER_TYPES as readonly string[]).includes(value);
}

export interface UseMarkerEditorOptions {
  map: L.Map | null;
  markers: readonly CragMapMarker[];
  version: number | undefined;
  saveMarkers(markers: CragMapMarker[]): Promise<CragMapMarker[]>;
  onSaved?(selectKey: string): void;
  onDeleted?(): void;
}

export interface MarkerEditor {
  /** The active edit, or null. */
  state: MarkerEditState | null;
  startEdit(index: number, marker: CragMapMarker): void;
  /** Start editing a marker that does not exist yet, pinned at `geo`. */
  startDraft(geo: LatLng): void;
  setLatText(value: string): void;
  setLonText(value: string): void;
  setType(value: string): void;
  setInfoText(value: string): void;
  /** Move the pin from the typed coordinates. Call when an input loses focus. */
  commitDraft(): void;
  beginDrag(): void;
  /** Update the fields while the pin is dragged. */
  moveTo(geo: LatLng): void;
  endDrag(geo: LatLng): void;
  cancel(): void;
  apply(): void;
  /** Remove the marker being edited. A draft is discarded. */
  remove(): void;
  /** Cancel because the card went away. Ignored while saving or dragging. */
  dismiss(): void;
}

/** Edit state for one map marker. The pin and the card both derive from `state`. */
export function useMarkerEditor(options: UseMarkerEditorOptions): MarkerEditor {
  const [state, setState] = useState<MarkerEditState | null>(null);
  const stateRef = useRef<MarkerEditState | null>(null);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const dispatch = useCallback((action: MarkerEditAction): MarkerEditState | null => {
    const next = reduceMarkerEdit(stateRef.current, action);
    if (next !== stateRef.current) {
      stateRef.current = next;
      setState(next);
    }
    return next;
  }, []);

  const persist = useCallback(async (edit: MarkerEditState, marker: CragMapMarker) => {
    const { map, markers } = optionsRef.current;
    if (!geoInView(map, marker.geo)) panTo(map, marker.geo);
    const next = edit.isNew
      ? [...markers, marker]
      : markers.map((item, index) => (markerKeyFromIndex(index) === edit.target ? marker : item));
    try {
      const saved = await optionsRef.current.saveMarkers(next);
      if (stateRef.current?.target !== edit.target) return;
      dispatch({ type: 'saveSucceeded' });
      const selectKey = edit.isNew ? markerKeyFromIndex(Math.max(saved.length - 1, 0)) : edit.target;
      optionsRef.current.onSaved?.(selectKey);
    } catch (error) {
      console.error('Failed to save marker:', error);
      if (stateRef.current?.target !== edit.target) return;
      dispatch({ type: 'saveFailed', message: saveErrorMessage(error) });
    }
  }, [dispatch]);

  const persistDelete = useCallback(async (edit: MarkerEditState, next: CragMapMarker[]) => {
    try {
      await optionsRef.current.saveMarkers(next);
      if (stateRef.current?.target !== edit.target) return;
      dispatch({ type: 'saveSucceeded' });
      optionsRef.current.onDeleted?.();
    } catch (error) {
      console.error('Failed to delete marker:', error);
      if (stateRef.current?.target !== edit.target) return;
      dispatch({ type: 'saveFailed', message: saveErrorMessage(error) });
    }
  }, [dispatch]);

  return useMemo<MarkerEditor>(() => ({
    state,
    startEdit(index, marker) {
      dispatch({
        type: 'start',
        target: markerKeyFromIndex(index),
        geo: marker.geo,
        markerType: marker.type,
        info: marker.info,
        isNew: false,
      });
    },
    startDraft(geo) {
      dispatch({
        type: 'start',
        target: DRAFT_MARKER_KEY,
        geo,
        markerType: DEFAULT_MARKER_TYPE,
        info: '',
        isNew: true,
      });
    },
    setLatText(value) {
      dispatch({ type: 'setLatText', value });
    },
    setLonText(value) {
      dispatch({ type: 'setLonText', value });
    },
    setType(value) {
      if (!isMarkerType(value)) return;
      dispatch({ type: 'setType', value });
    },
    setInfoText(value) {
      dispatch({ type: 'setInfoText', value });
    },
    commitDraft() {
      const before = stateRef.current;
      const after = dispatch({ type: 'commitDraft' });
      if (!before || !after || after.currentGeo === before.currentGeo) return;
      const { map } = optionsRef.current;
      if (!geoInView(map, after.currentGeo)) panTo(map, after.currentGeo);
    },
    beginDrag() {
      dispatch({ type: 'beginDrag' });
    },
    moveTo(geo) {
      dispatch({ type: 'moveTo', geo });
    },
    endDrag(geo) {
      dispatch({ type: 'endDrag', geo });
    },
    cancel() {
      const before = stateRef.current;
      const after = dispatch({ type: 'cancel' });
      if (!before || after) return;
      const { map } = optionsRef.current;
      if (!geoInView(map, before.originalGeo)) panTo(map, before.originalGeo);
    },
    apply() {
      const edit = stateRef.current;
      if (!edit || edit.saving) return;
      const prepared = prepareMarkerSave(edit);
      if (prepared.kind === 'invalid') {
        stateRef.current = prepared.state;
        setState(prepared.state);
        return;
      }
      if (prepared.kind === 'unchanged') {
        dispatch({ type: 'cancel' });
        return;
      }
      if (typeof optionsRef.current.version !== 'number') {
        dispatch({ type: 'saveFailed', message: MISSING_VERSION });
        return;
      }
      if (!edit.isNew) {
        const index = Number(edit.target);
        const { markers } = optionsRef.current;
        if (!Number.isInteger(index) || index < 0 || index >= markers.length) {
          dispatch({ type: 'saveFailed', message: 'This marker is no longer on the map.' });
          return;
        }
      }
      dispatch({
        type: 'saveStarted',
        markerType: prepared.marker.type,
        info: prepared.marker.info,
        geo: prepared.marker.geo,
      });
      void persist(edit, prepared.marker);
    },
    remove() {
      const edit = stateRef.current;
      if (!edit || edit.saving) return;
      if (edit.isNew) {
        dispatch({ type: 'cancel' });
        return;
      }
      if (typeof optionsRef.current.version !== 'number') {
        dispatch({ type: 'saveFailed', message: MISSING_VERSION });
        return;
      }
      const index = Number(edit.target);
      const { markers } = optionsRef.current;
      if (!Number.isInteger(index) || index < 0 || index >= markers.length) {
        dispatch({ type: 'saveFailed', message: 'This marker is no longer on the map.' });
        return;
      }
      const next = markers.filter((_, itemIndex) => itemIndex !== index);
      dispatch({ type: 'deleteStarted' });
      void persistDelete(edit, next);
    },
    dismiss() {
      dispatch({ type: 'dismiss' });
    },
  }), [state, dispatch, persist, persistDelete]);
}
