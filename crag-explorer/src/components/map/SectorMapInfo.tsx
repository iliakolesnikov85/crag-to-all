import React from 'react';
import { MdInfoOutline } from 'react-icons/md';
import { Link } from 'react-router';
import { useCrag } from '../../context/CragContext';
import type { SectorEditor } from '../../hooks/useSectorEditor';
import type { LatLng, Sector } from '../../types';
import { getCragImageUrl } from '../../utils/firebaseStorage';
import {
  formatSectorCoordinate,
  parseLatitude,
  parseLongitude,
} from '../../utils/map/sectorCoordinates';
import { sectorMarkerKey, type SectorEditState } from '../../utils/map/sectorEditState';
import Button from '../Button';
import PhotoLocationPrompt from '../PhotoLocationPrompt';
import { keepPinEditFocus, MapCoordinates, MapCoordinatesEditor, onPinEditKeyDown } from './MapCoordinatesEditor';
import SectorTopoInput from './SectorTopoInput';
import { useTopoFile } from './useTopoFile';
import './SectorMapInfo.scss';

const SECTOR_MAP_INFO_MAX_ROUTES = 4;
const SECTOR_MARKER_DRAG_HINT = 'You can drag the marker on the map to move it.';

function nameInputClass(invalid: boolean): string {
  return invalid
    ? 'sector-map-info__name-input sector-map-info__name-input--invalid'
    : 'sector-map-info__name-input';
}

function editedGeo(edit: SectorEditState): LatLng | null {
  const lat = parseLatitude(edit.latText);
  const lon = parseLongitude(edit.lonText);
  if (!lat.ok || !lon.ok) return null;
  return { lat: lat.value, lon: lon.value };
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
  const draft = isNew ? edit : null;
  const topo = useTopoFile({
    file: draft?.topoFile ?? null,
    checkLocation: draft != null,
    currentGeo: draft ? editedGeo(draft) : null,
    saving: draft?.saving ?? false,
    onAccept(file) {
      editor?.setTopoFile(file);
    },
    onUseLocation(geo) {
      if (!editor?.state || editor.state.saving) return;
      editor.setLatText(formatSectorCoordinate(geo.lat));
      editor.setLonText(formatSectorCoordinate(geo.lon));
      editor.commitDraft();
    },
  });
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
          onKeyDown={(event) => onPinEditKeyDown(event, editor, waitForPhotoLocation)}
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
              <MapCoordinatesEditor edit={edit} actions={editor} blockApply={waitForPhotoLocation} />
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
                  onMouseDown={keepPinEditFocus}
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
                  onMouseDown={keepPinEditFocus}
                  onClick={() => editor.cancel()}
                >
                  Cancel
                </Button>
              </div>
            </>
          ) : (
            <>
              {sector.geo ? (
                <MapCoordinates
                  geo={sector.geo}
                  editLabel={`Edit sector ${sector.name}`}
                  editTitle="Edit sector"
                  onEdit={canStartEdit ? () => editor.startEdit(sector) : null}
                />
              ) : null}
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
      <PhotoLocationPrompt
        location={topo.gpsPrompt}
        subject="the new sector"
        onUse={topo.usePhotoLocation}
        onKeep={topo.dismissGpsPrompt}
      />
    </div>
  );
};

export { SECTOR_MAP_INFO_MAX_ROUTES };

export default SectorMapInfo;
