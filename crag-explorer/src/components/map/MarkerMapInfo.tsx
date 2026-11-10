import React from 'react';
import { MdInfoOutline } from 'react-icons/md';
import { confirm } from '../../context/ConfirmContext';
import type { MarkerEditor } from '../../hooks/useMarkerEditor';
import { CRAG_MAP_MARKER_TYPES, type CragMapMarker } from '../../types';
import { markerLabelFromType } from '../../utils/map/overlayLayers';
import Button from '../Button';
import { keepPinEditFocus, MapCoordinates, MapCoordinatesEditor, onPinEditKeyDown } from './MapCoordinatesEditor';
import './MarkerMapInfo.scss';

const MARKER_DRAG_HINT = 'You can drag the marker on the map to move it.';

export interface MarkerMapInfoProps {
  markerKey: string;
  marker: CragMapMarker;
  /** Index in the saved marker list. Null while the pin is still a draft. */
  index: number | null;
  editor?: MarkerEditor | null;
  editable?: boolean;
  isNew?: boolean;
}

const MarkerMapInfo: React.FC<MarkerMapInfoProps> = ({
  markerKey,
  marker,
  index,
  editor = null,
  editable = false,
  isNew = false,
}) => {
  const edit = editor?.state && editor.state.target === markerKey ? editor.state : null;
  const label = markerLabelFromType(edit ? edit.markerType : marker.type);
  const canStartEdit = editable && editor != null && !isNew && index != null;

  const requestDelete = () => {
    if (!editor) return;
    void confirm({
      title: 'Delete marker',
      message: `Delete the "${label}" marker?`,
      confirmLabel: 'Delete',
      destructive: true,
    }).then((confirmed) => {
      if (!confirmed) return;
      editor.remove();
    });
  };

  return (
    <div className="marker-map-info">
      {edit && editor ? (
        <div className="marker-map-info__edit" onKeyDown={(event) => onPinEditKeyDown(event, editor)}>
          <label className="marker-map-info__field">
            <span className="marker-map-info__label">Type</span>
            <select
              className="marker-map-info__select"
              aria-label="Type"
              disabled={edit.saving}
              value={edit.markerType}
              onChange={(event) => editor.setType(event.target.value)}
            >
              {CRAG_MAP_MARKER_TYPES.map((type) => (
                <option key={type} value={type}>{markerLabelFromType(type)}</option>
              ))}
            </select>
          </label>
          <label className="marker-map-info__field">
            <span className="marker-map-info__label">Info</span>
            <textarea
              className={
                edit.infoError
                  ? 'marker-map-info__info-input marker-map-info__info-input--invalid'
                  : 'marker-map-info__info-input'
              }
              aria-label="Info"
              rows={3}
              disabled={edit.saving}
              value={edit.infoText}
              onChange={(event) => editor.setInfoText(event.target.value)}
            />
          </label>
          {edit.infoError ? (
            <p className="marker-map-info__error" role="alert">{edit.infoError}</p>
          ) : null}
          <MapCoordinatesEditor edit={edit} actions={editor} />
          <p className="marker-map-info__hint">
            <MdInfoOutline className="marker-map-info__hint-icon" aria-hidden="true" />
            <span>{MARKER_DRAG_HINT}</span>
          </p>
          <div className="marker-map-info__actions">
            <Button
              type="button"
              size="sm"
              variant="primary"
              aria-label={isNew ? 'Create marker' : `Save ${label}`}
              disabled={edit.saving}
              onMouseDown={keepPinEditFocus}
              onClick={() => editor.apply()}
            >
              Save
            </Button>
            {!isNew ? (
              <Button
                type="button"
                size="sm"
                variant="danger"
                aria-label={`Delete ${label}`}
                disabled={edit.saving}
                onMouseDown={keepPinEditFocus}
                onClick={requestDelete}
              >
                Delete
              </Button>
            ) : null}
            <Button
              type="button"
              size="sm"
              variant="secondary"
              aria-label={isNew ? 'Discard new marker' : `Cancel marker edit for ${label}`}
              disabled={edit.saving}
              onMouseDown={keepPinEditFocus}
              onClick={() => editor.cancel()}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <>
          <div className="marker-map-info__title">{label}</div>
          {marker.info.trim() ? (
            <p className="marker-map-info__info">{marker.info}</p>
          ) : null}
          <MapCoordinates
            geo={marker.geo}
            editLabel={`Edit ${label}`}
            editTitle="Edit marker"
            onEdit={canStartEdit ? () => editor.startEdit(index, marker) : null}
          />
        </>
      )}
    </div>
  );
};

export default MarkerMapInfo;
