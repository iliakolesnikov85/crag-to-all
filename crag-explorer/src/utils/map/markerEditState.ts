import type { CragMapMarker, CragMapMarkerType, LatLng } from '../../types';
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

const INFO_MAX_LENGTH = 2000;

function canMutate(state: MarkerEditState | null): state is MarkerEditState {
  return state != null && !state.saving;
}

function validateInfo(text: string): { ok: true; info: string } | { ok: false; error: string } {
  const info = text.trim();
  if (info.length > INFO_MAX_LENGTH) {
    return { ok: false, error: `Info must be at most ${INFO_MAX_LENGTH} characters.` };
  }
  return { ok: true, info };
}

/** Marker key of the pin being placed. It is not in the crag yet. */
export const DRAFT_MARKER_KEY = '__draft_marker__';
export const DEFAULT_MARKER_TYPE: CragMapMarkerType = 'parking_space';

/** One map marker being edited. `null` means nothing is being edited. */
export interface MarkerEditState extends GeoEditFields {
  /** Array index as a string, or DRAFT_MARKER_KEY for a marker that is not saved yet. */
  target: string;
  isNew: boolean;
  originalType: CragMapMarkerType;
  originalInfo: string;
  markerType: CragMapMarkerType;
  infoText: string;
  infoError: string | null;
}

export type MarkerEditAction =
  | {
      type: 'start';
      target: string;
      geo: LatLng;
      markerType: CragMapMarkerType;
      info: string;
      isNew: boolean;
    }
  | { type: 'setLatText'; value: string }
  | { type: 'setLonText'; value: string }
  | { type: 'setType'; value: CragMapMarkerType }
  | { type: 'setInfoText'; value: string }
  | { type: 'commitDraft' }
  | { type: 'beginDrag' }
  | { type: 'moveTo'; geo: LatLng }
  | { type: 'endDrag'; geo: LatLng }
  | { type: 'cancel' }
  | { type: 'dismiss' }
  | { type: 'saveStarted'; markerType: CragMapMarkerType; info: string; geo: LatLng }
  | { type: 'deleteStarted' }
  | { type: 'saveFailed'; message: string }
  | { type: 'saveSucceeded' };

export type PrepareMarkerSaveResult =
  | { kind: 'invalid'; state: MarkerEditState }
  | { kind: 'unchanged' }
  | { kind: 'save'; marker: CragMapMarker };

export function markerKeyFromIndex(index: number): string {
  return String(index);
}

export function startMarkerEdit(
  target: string,
  geo: LatLng,
  markerType: CragMapMarkerType,
  info: string,
  isNew: boolean,
): MarkerEditState {
  return {
    ...createGeoFields(geo),
    target,
    isNew,
    originalType: markerType,
    originalInfo: info,
    markerType,
    infoText: info,
    infoError: null,
  };
}

/** Validate the fields and build the marker. Does not change state. */
export function prepareMarkerSave(state: MarkerEditState): PrepareMarkerSaveResult {
  const parsed = parseGeoFields(state);
  const info = validateInfo(state.infoText);
  if (!('geo' in parsed) || !info.ok) {
    return {
      kind: 'invalid',
      state: {
        ...state,
        latError: 'geo' in parsed ? null : parsed.latError,
        lonError: 'geo' in parsed ? null : parsed.lonError,
        infoError: info.ok ? null : info.error,
      },
    };
  }
  const marker: CragMapMarker = {
    type: state.markerType,
    info: info.info,
    geo: parsed.geo,
  };
  if (
    !state.isNew
    && state.markerType === state.originalType
    && info.info === state.originalInfo
    && sameGeo(parsed.geo, state.originalGeo)
  ) {
    return { kind: 'unchanged' };
  }
  return { kind: 'save', marker };
}

export function reduceMarkerEdit(
  state: MarkerEditState | null,
  action: MarkerEditAction,
): MarkerEditState | null {
  switch (action.type) {
    case 'start':
      if (state?.saving) return state;
      return startMarkerEdit(action.target, action.geo, action.markerType, action.info, action.isNew);
    case 'setLatText':
      if (!canMutate(state)) return state;
      return setGeoLatText(state, action.value);
    case 'setLonText':
      if (!canMutate(state)) return state;
      return setGeoLonText(state, action.value);
    case 'setType':
      if (!canMutate(state)) return state;
      return { ...state, markerType: action.value, saveError: null };
    case 'setInfoText':
      if (!canMutate(state)) return state;
      return { ...state, infoText: action.value, infoError: null, saveError: null };
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
        markerType: action.markerType,
        infoText: action.info,
        infoError: null,
        saving: true,
      };
    case 'deleteStarted':
      if (!canMutate(state)) return state;
      return { ...state, saving: true, saveError: null };
    case 'saveFailed':
      if (!state) return state;
      return { ...state, saving: false, saveError: action.message };
    case 'saveSucceeded':
      return null;
  }
}
