import React from 'react';
import { MdEdit, MdLocationOn } from 'react-icons/md';
import type { LatLng } from '../../types';
import { formatSectorCoordinatePair } from '../../utils/map/sectorCoordinates';
import Button from '../Button';
import './MapCoordinatesEditor.scss';

function coordinateInputClass(invalid: boolean): string {
  return invalid
    ? 'map-coordinates__input map-coordinates__input--invalid'
    : 'map-coordinates__input';
}

export interface PinLocationFields {
  latText: string;
  lonText: string;
  latError: string | null;
  lonError: string | null;
  saveError: string | null;
  saving: boolean;
}

export interface PinLocationActions {
  setLatText(value: string): void;
  setLonText(value: string): void;
  commitDraft(): void;
  apply(): void;
  cancel(): void;
}

/** Blur would commit the draft and re-render before click, so the button can move
 * out from under the pointer. Keeping focus lets Apply and Cancel receive the click. */
export function keepPinEditFocus(event: React.MouseEvent<HTMLElement>): void {
  event.preventDefault();
}

export function onPinEditKeyDown(
  event: React.KeyboardEvent<HTMLElement>,
  actions: { apply(): void; cancel(): void },
  blockApply = false,
): void {
  // Esc must cancel the edit without also leaving map fullscreen.
  event.stopPropagation();
  if (event.key === 'Enter') {
    if (event.target instanceof HTMLTextAreaElement) return;
    event.preventDefault();
    if (!blockApply) actions.apply();
  } else if (event.key === 'Escape') {
    event.preventDefault();
    actions.cancel();
  }
}

export function MapCoordinatesEditor({
  edit,
  actions,
  blockApply = false,
}: {
  edit: PinLocationFields;
  actions: PinLocationActions;
  blockApply?: boolean;
}) {
  const disabled = edit.saving;
  return (
    <div
      className="map-coordinates map-coordinates--editing"
      aria-busy={disabled || undefined}
      onKeyDown={(event) => onPinEditKeyDown(event, actions, blockApply)}
    >
      <MdLocationOn className="map-coordinates__pin" aria-hidden="true" />
      <div className="map-coordinates__fields">
        <label className="map-coordinates__field">
          <span className="map-coordinates__label">Latitude</span>
          <input
            className={coordinateInputClass(edit.latError != null)}
            aria-label="Latitude"
            inputMode="decimal"
            autoComplete="off"
            spellCheck={false}
            disabled={disabled}
            value={edit.latText}
            onChange={(event) => actions.setLatText(event.target.value)}
            onBlur={() => actions.commitDraft()}
          />
        </label>
        <label className="map-coordinates__field">
          <span className="map-coordinates__label">Longitude</span>
          <input
            className={coordinateInputClass(edit.lonError != null)}
            aria-label="Longitude"
            inputMode="decimal"
            autoComplete="off"
            spellCheck={false}
            disabled={disabled}
            value={edit.lonText}
            onChange={(event) => actions.setLonText(event.target.value)}
            onBlur={() => actions.commitDraft()}
          />
        </label>
      </div>
      {(edit.latError || edit.lonError || edit.saveError) ? (
        <div className="map-coordinates__errors" role="alert">
          {edit.latError ? <p>{edit.latError}</p> : null}
          {edit.lonError ? <p>{edit.lonError}</p> : null}
          {edit.saveError ? <p>{edit.saveError}</p> : null}
        </div>
      ) : null}
    </div>
  );
}

export function MapCoordinates({
  geo,
  onEdit,
  editLabel,
  editTitle = 'Edit',
}: {
  geo: LatLng;
  /** Present when this pin can be moved. */
  onEdit: (() => void) | null;
  editLabel: string;
  editTitle?: string;
}) {
  return (
    <div className="map-coordinates">
      <MdLocationOn className="map-coordinates__pin" aria-hidden="true" />
      <span className="map-coordinates__value">{formatSectorCoordinatePair(geo)}</span>
      {onEdit ? (
        <div className="map-coordinates__actions">
          <Button
            type="button"
            iconOnly
            size="sm"
            variant="ghost"
            aria-label={editLabel}
            title={editTitle}
            onMouseDown={keepPinEditFocus}
            onClick={onEdit}
          >
            <MdEdit />
          </Button>
        </div>
      ) : null}
    </div>
  );
}
