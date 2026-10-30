import type { LatLng, Sector } from '../../types';
import { validateSectorName } from '../sectorName';
import {
  formatSectorCoordinate,
  parseLatitude,
  parseLongitude,
  sameSectorGeo,
} from './sectorCoordinates';

let activeEditor: SectorGeoEditor | null = null;

function viewSnapshot(geo: LatLng, name: string): SectorGeoEditorSnapshot {
  return {
    editing: false,
    saving: false,
    latText: formatSectorCoordinate(geo.lat),
    lonText: formatSectorCoordinate(geo.lon),
    nameText: name,
    latError: null,
    lonError: null,
    nameError: null,
    saveError: null,
  };
}

export interface SectorEditPatch {
  name?: string;
  geo?: LatLng;
}

export interface SectorGeoEditorSnapshot {
  editing: boolean;
  saving: boolean;
  latText: string;
  lonText: string;
  nameText: string;
  latError: string | null;
  lonError: string | null;
  nameError: string | null;
  saveError: string | null;
}

/** Leaflet (or a test double) operations the editor needs while a sector pin is being moved. */
export interface SectorGeoEditHost {
  setEditing(editing: boolean): void;
  setDragging(enabled: boolean): void;
  setLatLng(geo: LatLng): void;
  isInView(geo: LatLng): boolean;
  centerOn(geo: LatLng): void;
  hidePopup(): void;
  showPopup(): void;
  save(patch: SectorEditPatch): Promise<Sector>;
}

export interface SectorGeoEditor {
  subscribe(listener: () => void): () => void;
  getSnapshot(): SectorGeoEditorSnapshot;
  startEdit(): void;
  cancel(): void;
  apply(): void;
  setLatText(value: string): void;
  setLonText(value: string): void;
  setNameText(value: string): void;
  /** Move the marker from the typed coordinates. Call when an input loses focus. */
  commitDraft(): void;
  beginDrag(): void;
  /** Update the coordinate fields while the marker is dragged. Does not call setLatLng. */
  moveTo(geo: LatLng): void;
  endDrag(geo: LatLng): void;
  /** Cancel the edit because its popup or panel went away. Ignored while saving or dragging. */
  dismiss(): void;
  dispose(): void;
}

export function createSectorGeoEditor(options: {
  geo: LatLng;
  name: string;
  takenNames?: readonly string[];
  /** The sector does not exist yet, so Save always sends both name and geo. */
  isNew?: boolean;
  host: SectorGeoEditHost;
}): SectorGeoEditor {
  const { host, isNew = false } = options;
  const takenNames = options.takenNames ?? [];
  let disposed = false;
  let dragging = false;
  let original: LatLng = { lat: options.geo.lat, lon: options.geo.lon };
  let current: LatLng = original;
  let originalName = options.name;
  let snapshot = viewSnapshot(original, originalName);
  const listeners = new Set<() => void>();

  function emit(): void {
    if (disposed) return;
    for (const listener of [...listeners]) listener();
  }

  function canMutate(): boolean {
    return !disposed && snapshot.editing && !snapshot.saving;
  }

  function readDraftOrShowErrors(): LatLng | null {
    const lat = parseLatitude(snapshot.latText);
    const lon = parseLongitude(snapshot.lonText);
    if (lat.ok && lon.ok) return { lat: lat.value, lon: lon.value };
    snapshot = {
      ...snapshot,
      latError: lat.ok ? null : lat.error,
      lonError: lon.ok ? null : lon.error,
    };
    emit();
    return null;
  }

  function readEditOrShowErrors(): { name: string; geo: LatLng } | null {
    const lat = parseLatitude(snapshot.latText);
    const lon = parseLongitude(snapshot.lonText);
    const name = validateSectorName(snapshot.nameText, takenNames);
    if (lat.ok && lon.ok && name.ok) {
      return { name: name.name, geo: { lat: lat.value, lon: lon.value } };
    }
    snapshot = {
      ...snapshot,
      latError: lat.ok ? null : lat.error,
      lonError: lon.ok ? null : lon.error,
      nameError: name.ok ? null : name.error,
    };
    emit();
    return null;
  }

  function placeMarker(next: LatLng): void {
    if (sameSectorGeo(current, next)) return;
    current = next;
    host.setLatLng(next);
    if (!host.isInView(next)) host.centerOn(next);
  }

  function exitEdit(): void {
    dragging = false;
    host.setDragging(false);
    host.setEditing(false);
    snapshot = viewSnapshot(current, originalName);
    if (activeEditor === api) activeEditor = null;
    emit();
  }

  function revert(recenter: boolean): void {
    if (!canMutate()) return;
    current = original;
    host.setLatLng(original);
    if (recenter && !host.isInView(original)) host.centerOn(original);
    exitEdit();
  }

  function publishDraft(next: LatLng): void {
    snapshot = {
      ...snapshot,
      latText: formatSectorCoordinate(next.lat),
      lonText: formatSectorCoordinate(next.lon),
      latError: null,
      lonError: null,
      saveError: null,
    };
    emit();
  }

  async function persist(patch: SectorEditPatch): Promise<void> {
    try {
      const saved = await host.save(patch);
      if (disposed) return;
      const savedGeo = saved.geo ?? patch.geo ?? current;
      original = savedGeo;
      current = savedGeo;
      originalName = saved.name;
      exitEdit();
    } catch (error) {
      console.error('Failed to save sector:', error);
      if (disposed) return;
      snapshot = {
        ...snapshot,
        saving: false,
        saveError: error instanceof Error && error.message.trim()
          ? error.message
          : 'Could not save sector',
      };
      emit();
    }
  }

  const api: SectorGeoEditor = {
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getSnapshot() {
      return snapshot;
    },
    startEdit() {
      if (disposed || snapshot.saving || snapshot.editing) return;
      if (activeEditor && activeEditor !== api) {
        if (activeEditor.getSnapshot().saving) return;
        activeEditor.dismiss();
      }
      original = current;
      snapshot = { ...viewSnapshot(current, originalName), editing: true };
      activeEditor = api;
      host.setEditing(true);
      host.setDragging(true);
      emit();
    },
    cancel() {
      revert(true);
    },
    apply() {
      if (!canMutate()) return;
      const next = readEditOrShowErrors();
      if (!next) return;
      placeMarker(next.geo);
      const patch: SectorEditPatch = {};
      if (isNew || next.name !== originalName) patch.name = next.name;
      if (isNew || !sameSectorGeo(next.geo, original)) patch.geo = next.geo;
      if (patch.name === undefined && patch.geo === undefined) {
        exitEdit();
        return;
      }
      snapshot = {
        ...snapshot,
        latText: formatSectorCoordinate(next.geo.lat),
        lonText: formatSectorCoordinate(next.geo.lon),
        nameText: next.name,
        latError: null,
        lonError: null,
        nameError: null,
        saveError: null,
        saving: true,
      };
      emit();
      void persist(patch);
    },
    setLatText(value: string) {
      if (!canMutate()) return;
      snapshot = { ...snapshot, latText: value, latError: null, saveError: null };
      emit();
    },
    setLonText(value: string) {
      if (!canMutate()) return;
      snapshot = { ...snapshot, lonText: value, lonError: null, saveError: null };
      emit();
    },
    setNameText(value: string) {
      if (!canMutate()) return;
      snapshot = { ...snapshot, nameText: value, nameError: null, saveError: null };
      emit();
    },
    commitDraft() {
      if (!canMutate()) return;
      const next = readDraftOrShowErrors();
      if (!next) return;
      placeMarker(next);
      publishDraft(next);
    },
    beginDrag() {
      if (!canMutate()) return;
      dragging = true;
      host.hidePopup();
    },
    moveTo(geo: LatLng) {
      if (!canMutate()) return;
      current = { lat: geo.lat, lon: geo.lon };
      publishDraft(current);
    },
    endDrag(geo: LatLng) {
      if (!canMutate()) return;
      dragging = false;
      api.moveTo(geo);
      host.showPopup();
    },
    dismiss() {
      if (dragging) return;
      revert(false);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      if (activeEditor === api) activeEditor = null;
      listeners.clear();
    },
  };

  return api;
}
