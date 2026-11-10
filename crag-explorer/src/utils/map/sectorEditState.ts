import type { LatLng, Sector } from '../../types';
import { validateSectorName } from '../sectorName';
import {
  beginGeoDrag,
  commitGeoDraft,
  createGeoFields,
  endGeoDrag,
  moveGeoTo,
  parseGeoFields,
  sameGeo,
  setGeoLatText,
  setGeoLonText,
  withGeoText,
  type GeoEditFields,
} from './geoEdit';

function canMutate(state: SectorEditState | null): state is SectorEditState {
  return state != null && !state.saving;
}

/** Marker key of the sector being placed. It is not in the crag yet. */
export const DRAFT_SECTOR_ID = '__draft__';
export const DRAFT_SECTOR_LABEL = 'New sector';

export interface SectorEditPatch {
  name?: string;
  geo?: LatLng;
}

/** One sector pin being edited. `null` means nothing is being edited. */
export interface SectorEditState extends GeoEditFields {
  /** Sector id, or DRAFT_SECTOR_ID for a sector that is not saved yet. */
  target: string;
  isNew: boolean;
  originalName: string;
  nameText: string;
  nameError: string | null;
  /** Topo chosen for a draft sector. Uploaded with the sector on save. */
  topoFile: File | null;
}

export type SectorEditAction =
  | { type: 'start'; target: string; geo: LatLng; name: string; isNew: boolean }
  | { type: 'setLatText'; value: string }
  | { type: 'setLonText'; value: string }
  | { type: 'setNameText'; value: string }
  | { type: 'setTopoFile'; file: File | null }
  | { type: 'commitDraft' }
  | { type: 'beginDrag' }
  | { type: 'moveTo'; geo: LatLng }
  | { type: 'endDrag'; geo: LatLng }
  | { type: 'cancel' }
  | { type: 'dismiss' }
  | { type: 'saveStarted'; name: string; geo: LatLng }
  | { type: 'saveFailed'; message: string }
  | { type: 'saveSucceeded' };

export type PrepareSaveResult =
  | { kind: 'invalid'; state: SectorEditState }
  | { kind: 'unchanged' }
  | { kind: 'save'; name: string; geo: LatLng; patch: SectorEditPatch };

export function sectorMarkerKey(sector: Sector): string {
  return sector.id ?? `name:${sector.name}`;
}

export function startSectorEdit(
  target: string,
  geo: LatLng,
  name: string,
  isNew: boolean,
): SectorEditState {
  return {
    ...createGeoFields(geo),
    target,
    isNew,
    originalName: name,
    nameText: name,
    nameError: null,
    topoFile: null,
  };
}

/** Validate the fields and compute the patch. Does not change state. */
export function prepareSectorSave(
  state: SectorEditState,
  takenNames: readonly string[],
): PrepareSaveResult {
  const parsed = parseGeoFields(state);
  const name = validateSectorName(state.nameText, takenNames);
  if (!('geo' in parsed) || !name.ok) {
    return {
      kind: 'invalid',
      state: {
        ...state,
        latError: 'geo' in parsed ? null : parsed.latError,
        lonError: 'geo' in parsed ? null : parsed.lonError,
        nameError: name.ok ? null : name.error,
      },
    };
  }
  const patch: SectorEditPatch = {};
  if (state.isNew || name.name !== state.originalName) patch.name = name.name;
  if (state.isNew || !sameGeo(parsed.geo, state.originalGeo)) patch.geo = parsed.geo;
  if (patch.name === undefined && patch.geo === undefined) return { kind: 'unchanged' };
  return { kind: 'save', name: name.name, geo: parsed.geo, patch };
}

export function reduceSectorEdit(
  state: SectorEditState | null,
  action: SectorEditAction,
): SectorEditState | null {
  switch (action.type) {
    case 'start':
      if (state?.saving) return state;
      return startSectorEdit(action.target, action.geo, action.name, action.isNew);
    case 'setLatText':
      if (!canMutate(state)) return state;
      return setGeoLatText(state, action.value);
    case 'setLonText':
      if (!canMutate(state)) return state;
      return setGeoLonText(state, action.value);
    case 'setNameText':
      if (!canMutate(state)) return state;
      return { ...state, nameText: action.value, nameError: null, saveError: null };
    case 'setTopoFile':
      if (!canMutate(state)) return state;
      return { ...state, topoFile: action.file, saveError: null };
    case 'commitDraft':
      if (!canMutate(state)) return state;
      return commitGeoDraft(state);
    case 'beginDrag':
      if (!canMutate(state)) return state;
      return beginGeoDrag(state);
    case 'moveTo':
      if (!canMutate(state)) return state;
      return moveGeoTo(state, action.geo);
    case 'endDrag':
      if (!canMutate(state)) return state;
      return endGeoDrag(state, action.geo);
    case 'cancel':
      if (!canMutate(state)) return state;
      return null;
    case 'dismiss':
      if (!canMutate(state) || state.dragging) return state;
      return null;
    case 'saveStarted':
      if (!canMutate(state)) return state;
      return {
        ...withGeoText(state, action.geo),
        nameText: action.name,
        nameError: null,
        saving: true,
      };
    case 'saveFailed':
      if (!state) return state;
      return { ...state, saving: false, saveError: action.message };
    case 'saveSucceeded':
      return null;
  }
}
