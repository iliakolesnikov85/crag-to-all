import React from 'react';
import { MdEdit, MdInfoOutline, MdLocationOn } from 'react-icons/md';
import { Link } from 'react-router';
import { useCrag } from '../../context/CragContext';
import type { SectorEditor } from '../../hooks/useSectorEditor';
import type { Sector } from '../../types';
import { getCragImageUrl } from '../../utils/firebaseStorage';
import { formatSectorCoordinatePair } from '../../utils/map/sectorCoordinates';
import { sectorMarkerKey, type SectorEditState } from '../../utils/map/sectorEditState';
import Button from '../Button';
import Modal from '../Modal';
import SectorTopoInput from './SectorTopoInput';
import { useTopoPicker } from './useTopoPicker';
import './SectorMapInfo.scss';

const SECTOR_MAP_INFO_MAX_ROUTES = 4;
const SECTOR_MARKER_DRAG_HINT = 'You can drag the marker on the map to move it.';

/** Blur would commit the draft and re-render before click, so the button can move
 * out from under the pointer. Keeping focus lets Apply and Cancel receive the click. */
function keepFocus(event: React.MouseEvent<HTMLElement>): void {
  event.preventDefault();
}

function onEditKeyDown(
  event: React.KeyboardEvent<HTMLDivElement>,
  editor: SectorEditor,
  blockApply = false,
): void {
  // Esc must cancel the edit without also leaving map fullscreen.
  event.stopPropagation();
  if (event.key === 'Enter') {
    event.preventDefault();
    if (!blockApply) editor.apply();
  } else if (event.key === 'Escape') {
    event.preventDefault();
    editor.cancel();
  }
}

function coordinateInputClass(invalid: boolean): string {
  return invalid
    ? 'sector-map-info__coord-input sector-map-info__coord-input--invalid'
    : 'sector-map-info__coord-input';
}

function nameInputClass(invalid: boolean): string {
  return invalid
    ? 'sector-map-info__name-input sector-map-info__name-input--invalid'
    : 'sector-map-info__name-input';
}

function SectorCoordinatesEditor({
  edit,
  editor,
  blockApply,
}: {
  edit: SectorEditState;
  editor: SectorEditor;
  blockApply: boolean;
}) {
  const disabled = edit.saving;
  return (
    <div
      className="sector-map-info__coords sector-map-info__coords--editing"
      aria-busy={disabled || undefined}
      onKeyDown={(event) => onEditKeyDown(event, editor, blockApply)}
    >
      <MdLocationOn className="sector-map-info__coords-pin" aria-hidden="true" />
      <div className="sector-map-info__coords-fields">
        <label className="sector-map-info__coord">
          <span className="sector-map-info__coord-label">Latitude</span>
          <input
            className={coordinateInputClass(edit.latError != null)}
            aria-label="Latitude"
            inputMode="decimal"
            autoComplete="off"
            spellCheck={false}
            disabled={disabled}
            value={edit.latText}
            onChange={(event) => editor.setLatText(event.target.value)}
            onBlur={() => editor.commitDraft()}
          />
        </label>
        <label className="sector-map-info__coord">
          <span className="sector-map-info__coord-label">Longitude</span>
          <input
            className={coordinateInputClass(edit.lonError != null)}
            aria-label="Longitude"
            inputMode="decimal"
            autoComplete="off"
            spellCheck={false}
            disabled={disabled}
            value={edit.lonText}
            onChange={(event) => editor.setLonText(event.target.value)}
            onBlur={() => editor.commitDraft()}
          />
        </label>
      </div>
      {(edit.latError || edit.lonError || edit.saveError) ? (
        <div className="sector-map-info__coords-errors" role="alert">
          {edit.latError ? <p>{edit.latError}</p> : null}
          {edit.lonError ? <p>{edit.lonError}</p> : null}
          {edit.saveError ? <p>{edit.saveError}</p> : null}
        </div>
      ) : null}
    </div>
  );
}

function SectorCoordinates({
  sector,
  onEdit,
}: {
  sector: Sector;
  /** Present when this sector's pin can be moved. */
  onEdit: (() => void) | null;
}) {
  if (!sector.geo) return null;

  return (
    <div className="sector-map-info__coords">
      <MdLocationOn className="sector-map-info__coords-pin" aria-hidden="true" />
      <span className="sector-map-info__coords-value">{formatSectorCoordinatePair(sector.geo)}</span>
      {onEdit ? (
        <div className="sector-map-info__coords-actions">
          <Button
            type="button"
            iconOnly
            size="sm"
            variant="ghost"
            aria-label={`Edit sector ${sector.name}`}
            title="Edit sector"
            onMouseDown={keepFocus}
            onClick={onEdit}
          >
            <MdEdit />
          </Button>
        </div>
      ) : null}
    </div>
  );
}

export interface SectorMapInfoProps {
  sector: Sector;
  maxRoutes?: number;
  /** Shared pin editor. The card edits when `editor.state` targets this sector. */
  editor?: SectorEditor | null;
  /** Whether this sector's pin may be moved and renamed. */
  editable?: boolean;
  /** The sector is a draft placed on the map and has not been saved yet. */
  isNew?: boolean;
}

const SectorMapInfo: React.FC<SectorMapInfoProps> = ({
  sector,
  maxRoutes = SECTOR_MAP_INFO_MAX_ROUTES,
  editor = null,
  editable = false,
  isNew = false,
}) => {
  const { crag, getUrl } = useCrag();
  const edit = editor?.state && editor.state.target === sectorMarkerKey(sector) ? editor.state : null;
  const topo = useTopoPicker(isNew ? edit : null, isNew ? editor : null);
  const editing = edit != null && editor != null;
  const displayName = edit ? edit.nameText : sector.name;
  const sectorPath = getUrl(`sector/${encodeURIComponent(displayName.toLowerCase())}`);
  const firstImage = sector.images?.[0];
  const imageUrl = firstImage
    ? getCragImageUrl(crag.cragId, firstImage.imageFile)
    : null;
  const routes = sector.routes ?? [];
  const visible = routes.slice(0, maxRoutes);
  const remaining = routes.length - visible.length;
  const waitForPhotoLocation = topo.pending || topo.gpsPrompt != null;
  const canStartEdit = editable && editor != null && sector.id != null && typeof sector.version === 'number';

  return (
    <div className="sector-map-info">
      {editing ? (
        <div
          className="sector-map-info__name-edit"
          onKeyDown={(event) => onEditKeyDown(event, editor, waitForPhotoLocation)}
        >
          <label className="sector-map-info__name-field">
            <span className="sector-map-info__name-label">Name</span>
            <input
              className={nameInputClass(edit.nameError != null)}
              aria-label="Name"
              autoComplete="off"
              spellCheck={false}
              disabled={edit.saving}
              value={edit.nameText}
              onChange={(event) => editor.setNameText(event.target.value)}
            />
          </label>
          {edit.nameError ? (
            <p className="sector-map-info__name-error" role="alert">{edit.nameError}</p>
          ) : null}
        </div>
      ) : (
        <Link to={sectorPath} className="sector-map-info__name">
          {displayName}
        </Link>
      )}
      <div className="sector-map-info__body">
        {isNew && editing ? (
          <div className="sector-map-info__topo">
            <SectorTopoInput
              disabled={edit.saving}
              previewUrl={topo.previewUrl}
              onFile={topo.chooseFile}
            />
            {topo.pending ? (
              <p className="sector-map-info__topo-status" role="status">Checking photo...</p>
            ) : topo.error ? (
              <p className="sector-map-info__topo-error" role="alert">{topo.error}</p>
            ) : null}
          </div>
        ) : imageUrl ? (
          editing ? (
            <span className="sector-map-info__image-frame">
              <img className="sector-map-info__image" src={imageUrl} alt="" />
            </span>
          ) : (
            <Link to={sectorPath} className="sector-map-info__image-link">
              <img className="sector-map-info__image" src={imageUrl} alt="" />
            </Link>
          )
        ) : null}
        <div className="sector-map-info__details">
          {editing ? (
            <>
              <SectorCoordinatesEditor edit={edit} editor={editor} blockApply={waitForPhotoLocation} />
              <p className="sector-map-info__hint">
                <MdInfoOutline className="sector-map-info__hint-icon" aria-hidden="true" />
                <span>{SECTOR_MARKER_DRAG_HINT}</span>
              </p>
              <div className="sector-map-info__edit-actions">
                <Button
                  type="button"
                  size="sm"
                  variant="primary"
                  aria-label={isNew ? 'Create sector' : `Save sector ${displayName}`}
                  disabled={edit.saving || waitForPhotoLocation}
                  onMouseDown={keepFocus}
                  onClick={() => {
                    if (waitForPhotoLocation) return;
                    editor.apply();
                  }}
                >
                  Save
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  aria-label={isNew ? 'Discard new sector' : `Cancel sector edit for ${displayName}`}
                  disabled={edit.saving}
                  onMouseDown={keepFocus}
                  onClick={() => editor.cancel()}
                >
                  Cancel
                </Button>
              </div>
            </>
          ) : (
            <>
              <SectorCoordinates
                sector={sector}
                onEdit={canStartEdit ? () => editor.startEdit(sector) : null}
              />
              <div className="sector-map-info__routes">
                {visible.map((route) => (
                  <div key={`${route.name}-${route.grade}`} className="sector-map-info__route">
                    {route.name}, {route.grade}
                  </div>
                ))}
                {remaining > 0 && (
                  <Link to={sectorPath} className="sector-map-info__more">
                    and {remaining} more...
                  </Link>
                )}
              </div>
            </>
          )}
        </div>
      </div>
      {topo.gpsPrompt ? (
        <Modal
          open
          title="Use photo location?"
          onClose={topo.dismissGpsPrompt}
          footer={
            <>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={topo.dismissGpsPrompt}
              >
                Keep map location
              </Button>
              <Button type="button" size="sm" variant="primary" onClick={topo.usePhotoLocation}>
                Use photo location
              </Button>
            </>
          }
        >
          <p className="sector-map-info__location-prompt">
            This photo was taken at {formatSectorCoordinatePair(topo.gpsPrompt)}. Use that location for the new sector?
          </p>
        </Modal>
      ) : null}
    </div>
  );
};

export { SECTOR_MAP_INFO_MAX_ROUTES };

export default SectorMapInfo;
