import { useCallback, useMemo, useRef, useState } from 'react';
import type * as L from 'leaflet';
import type { LatLng, Sector } from '../types';
import {
  DRAFT_SECTOR_ID,
  prepareSectorSave,
  reduceSectorEdit,
  type SectorEditAction,
  type SectorEditPatch,
  type SectorEditState,
} from '../utils/map/sectorEditState';

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
  return error instanceof Error && error.message.trim() ? error.message : 'Could not save sector';
}

export interface NewSectorInput {
  name: string;
  geo: LatLng;
}

export interface UseSectorEditorOptions {
  map: L.Map | null;
  sectors: readonly Sector[];
  saveSector(sector: Sector, patch: SectorEditPatch): Promise<Sector>;
  createSector(input: NewSectorInput, topo: File | null): Promise<Sector>;
  onSaved?(sector: Sector): void;
  onCreated?(sector: Sector): void;
}

export interface SectorEditor {
  /** The active edit, or null. */
  state: SectorEditState | null;
  startEdit(sector: Sector): void;
  /** Start editing a sector that does not exist yet, pinned at `geo`. */
  startDraft(geo: LatLng): void;
  setLatText(value: string): void;
  setLonText(value: string): void;
  setNameText(value: string): void;
  setTopoFile(file: File | null): void;
  /** Move the pin from the typed coordinates. Call when an input loses focus. */
  commitDraft(): void;
  beginDrag(): void;
  /** Update the fields while the pin is dragged. */
  moveTo(geo: LatLng): void;
  endDrag(geo: LatLng): void;
  cancel(): void;
  apply(): void;
  /** Cancel because the card went away. Ignored while saving or dragging. */
  dismiss(): void;
}

/** Edit state for one sector pin. The marker and the card both derive from `state`. */
export function useSectorEditor(options: UseSectorEditorOptions): SectorEditor {
  const [state, setState] = useState<SectorEditState | null>(null);
  const stateRef = useRef<SectorEditState | null>(null);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const dispatch = useCallback((action: SectorEditAction): SectorEditState | null => {
    const next = reduceSectorEdit(stateRef.current, action);
    if (next !== stateRef.current) {
      stateRef.current = next;
      setState(next);
    }
    return next;
  }, []);

  const takenNames = useCallback((target: string): string[] => {
    return optionsRef.current.sectors
      .filter((sector) => (sector.id ?? null) !== target)
      .map((sector) => sector.name);
  }, []);

  const persist = useCallback(async (edit: SectorEditState, patch: SectorEditPatch, name: string, geo: LatLng) => {
    const { map } = optionsRef.current;
    if (!geoInView(map, geo)) panTo(map, geo);
    try {
      let saved: Sector;
      if (edit.isNew) {
        saved = await optionsRef.current.createSector({ name, geo }, edit.topoFile);
      } else {
        const sector = optionsRef.current.sectors.find((item) => item.id === edit.target);
        if (!sector) throw new Error('This sector is no longer on the map.');
        saved = await optionsRef.current.saveSector(sector, patch);
      }
      if (stateRef.current?.target !== edit.target) return;
      dispatch({ type: 'saveSucceeded' });
      if (edit.isNew) optionsRef.current.onCreated?.(saved);
      else optionsRef.current.onSaved?.(saved);
    } catch (error) {
      console.error('Failed to save sector:', error);
      if (stateRef.current?.target !== edit.target) return;
      dispatch({ type: 'saveFailed', message: saveErrorMessage(error) });
    }
  }, [dispatch]);

  return useMemo<SectorEditor>(() => ({
    state,
    startEdit(sector) {
      if (!sector.id || !sector.geo || typeof sector.version !== 'number') return;
      dispatch({ type: 'start', target: sector.id, geo: sector.geo, name: sector.name, isNew: false });
    },
    startDraft(geo) {
      dispatch({ type: 'start', target: DRAFT_SECTOR_ID, geo, name: '', isNew: true });
    },
    setLatText(value) {
      dispatch({ type: 'setLatText', value });
    },
    setLonText(value) {
      dispatch({ type: 'setLonText', value });
    },
    setNameText(value) {
      dispatch({ type: 'setNameText', value });
    },
    setTopoFile(file) {
      dispatch({ type: 'setTopoFile', file });
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
      const prepared = prepareSectorSave(edit, takenNames(edit.target));
      if (prepared.kind === 'invalid') {
        stateRef.current = prepared.state;
        setState(prepared.state);
        return;
      }
      if (prepared.kind === 'unchanged') {
        dispatch({ type: 'cancel' });
        return;
      }
      dispatch({ type: 'saveStarted', name: prepared.name, geo: prepared.geo });
      void persist(edit, prepared.patch, prepared.name, prepared.geo);
    },
    dismiss() {
      dispatch({ type: 'dismiss' });
    },
  }), [state, dispatch, takenNames, persist]);
}
