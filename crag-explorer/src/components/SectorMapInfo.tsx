import React, { useSyncExternalStore } from 'react';
import type { Root } from 'react-dom/client';
import { MdEdit, MdInfoOutline, MdLocationOn } from 'react-icons/md';
import { Link } from 'react-router';
import { CragContext, CragContextType, useCrag } from '../context/CragContext';
import type { Sector } from '../types';
import { formatSectorCoordinatePair } from '../utils/map/sectorCoordinates';
import type { SectorGeoEditor, SectorGeoEditorSnapshot } from '../utils/map/sectorGeoEditor';
import { getCragImageUrl } from '../utils/firebaseStorage';
import Button from './Button';
import './SectorMapInfo.scss';

const SECTOR_MAP_INFO_MAX_ROUTES = 4;
const SECTOR_MARKER_DRAG_HINT = 'You can drag the marker on the map to move it.';

const READ_ONLY_SNAPSHOT: SectorGeoEditorSnapshot = {
  editing: false,
  saving: false,
  latText: '',
  lonText: '',
  nameText: '',
  latError: null,
  lonError: null,
  nameError: null,
  saveError: null,
};

function subscribeToNothing(): () => void {
  return () => { };
}

function getReadOnlySnapshot(): SectorGeoEditorSnapshot {
  return READ_ONLY_SNAPSHOT;
}

function useGeoEditorSnapshot(geoEditor?: SectorGeoEditor | null): SectorGeoEditorSnapshot {
  return useSyncExternalStore(
    geoEditor ? geoEditor.subscribe : subscribeToNothing,
    geoEditor ? geoEditor.getSnapshot : getReadOnlySnapshot,
    geoEditor ? geoEditor.getSnapshot : getReadOnlySnapshot,
  );
}

function keepCoordinateFocus(event: React.MouseEvent<HTMLElement>): void {
  // Blur would commit the draft and re-render before click, so the button can move
  // out from under the pointer. Keeping focus lets Apply and Cancel receive the click.
  // Stopping the event here also keeps Leaflet from treating it as a map click that
  // closes the popup.
  event.preventDefault();
  event.stopPropagation();
}

function onEditKeyDown(
  event: React.KeyboardEvent<HTMLDivElement>,
  editor: SectorGeoEditor,
): void {
  event.stopPropagation();
  if (event.key === 'Enter') {
    event.preventDefault();
    editor.apply();
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

function SectorNavLink({
  to,
  className,
  children,
  navigate,
}: {
  to: string;
  className?: string;
  children: React.ReactNode;
  navigate?: (to: string) => void;
}) {
  if (navigate) {
    return (
      <a
        href={to}
        className={className}
        rel="noopener noreferrer"
        onClick={(event) => {
          if (event.defaultPrevented) return;
          if (event.button !== 0) return;
          if (event.metaKey || event.altKey || event.ctrlKey || event.shiftKey) return;
          event.preventDefault();
          navigate(to);
        }}
      >
        {children}
      </a>
    );
  }

  return (
    <Link to={to} className={className}>
      {children}
    </Link>
  );
}

function SectorCoordinates({
  sector,
  geoEditor,
}: {
  sector: Sector;
  geoEditor?: SectorGeoEditor | null;
}) {
  const snapshot = useGeoEditorSnapshot(geoEditor);

  if (snapshot.editing && geoEditor) {
    const disabled = snapshot.saving;
    return (
      <div
        className="sector-map-info__coords sector-map-info__coords--editing"
        aria-busy={disabled || undefined}
        onKeyDown={(event) => onEditKeyDown(event, geoEditor)}
      >
        <MdLocationOn className="sector-map-info__coords-pin" aria-hidden="true" />
        <div className="sector-map-info__coords-fields">
          <label className="sector-map-info__coord">
            <span className="sector-map-info__coord-label">Latitude</span>
            <input
              className={coordinateInputClass(snapshot.latError != null)}
              aria-label="Latitude"
              inputMode="decimal"
              autoComplete="off"
              spellCheck={false}
              disabled={disabled}
              value={snapshot.latText}
              onChange={(event) => geoEditor.setLatText(event.target.value)}
              onBlur={() => geoEditor.commitDraft()}
            />
          </label>
          <label className="sector-map-info__coord">
            <span className="sector-map-info__coord-label">Longitude</span>
            <input
              className={coordinateInputClass(snapshot.lonError != null)}
              aria-label="Longitude"
              inputMode="decimal"
              autoComplete="off"
              spellCheck={false}
              disabled={disabled}
              value={snapshot.lonText}
              onChange={(event) => geoEditor.setLonText(event.target.value)}
              onBlur={() => geoEditor.commitDraft()}
            />
          </label>
        </div>
        {(snapshot.latError || snapshot.lonError || snapshot.saveError) ? (
          <div className="sector-map-info__coords-errors" role="alert">
            {snapshot.latError ? <p>{snapshot.latError}</p> : null}
            {snapshot.lonError ? <p>{snapshot.lonError}</p> : null}
            {snapshot.saveError ? <p>{snapshot.saveError}</p> : null}
          </div>
        ) : null}
      </div>
    );
  }

  const label = geoEditor
    ? `${snapshot.latText}, ${snapshot.lonText}`
    : sector.geo
      ? formatSectorCoordinatePair(sector.geo)
      : null;
  if (!label) return null;

  return (
    <div className="sector-map-info__coords">
      <MdLocationOn className="sector-map-info__coords-pin" aria-hidden="true" />
      <span className="sector-map-info__coords-value">{label}</span>
      {geoEditor ? (
        <div className="sector-map-info__coords-actions">
          <Button
            type="button"
            iconOnly
            size="sm"
            variant="ghost"
            aria-label={`Edit sector ${snapshot.nameText}`}
            title="Edit sector"
            onMouseDown={keepCoordinateFocus}
            onClick={(event) => {
              keepCoordinateFocus(event);
              geoEditor.startEdit();
            }}
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
  /** When set (e.g. Leaflet popup outside the router tree), links call this instead of <Link>. */
  navigate?: (to: string) => void;
  /** Present when this sector's pin can be moved. */
  geoEditor?: SectorGeoEditor | null;
}

const SectorMapInfo: React.FC<SectorMapInfoProps> = ({
  sector,
  maxRoutes = SECTOR_MAP_INFO_MAX_ROUTES,
  navigate,
  geoEditor,
}) => {
  const { crag, getUrl } = useCrag();
  const snapshot = useGeoEditorSnapshot(geoEditor);
  const editing = snapshot.editing;
  const displayName = geoEditor ? snapshot.nameText : sector.name;
  const sectorPath = getUrl(
    `sector/${encodeURIComponent(displayName.toLowerCase())}`,
  );
  const firstImage = sector.images?.[0];
  const imageUrl = firstImage
    ? getCragImageUrl(crag.cragId, firstImage.imageFile)
    : null;
  const routes = sector.routes ?? [];
  const visible = routes.slice(0, maxRoutes);
  const remaining = routes.length - visible.length;

  return (
    <div className="sector-map-info">
      {editing && geoEditor ? (
        <div
          className="sector-map-info__name-edit"
          onKeyDown={(event) => onEditKeyDown(event, geoEditor)}
        >
          <label className="sector-map-info__name-field">
            <span className="sector-map-info__name-label">Name</span>
            <input
              className={nameInputClass(snapshot.nameError != null)}
              aria-label="Name"
              autoComplete="off"
              spellCheck={false}
              disabled={snapshot.saving}
              value={snapshot.nameText}
              onChange={(event) => geoEditor.setNameText(event.target.value)}
            />
          </label>
          {snapshot.nameError ? (
            <p className="sector-map-info__name-error" role="alert">{snapshot.nameError}</p>
          ) : null}
        </div>
      ) : (
        <SectorNavLink
          to={sectorPath}
          className="sector-map-info__name"
          navigate={navigate}
        >
          {displayName}
        </SectorNavLink>
      )}
      <div className="sector-map-info__body">
        {imageUrl ? (
          editing ? (
            <span className="sector-map-info__image-frame">
              <img className="sector-map-info__image" src={imageUrl} alt="" />
            </span>
          ) : (
            <SectorNavLink
              to={sectorPath}
              className="sector-map-info__image-link"
              navigate={navigate}
            >
              <img className="sector-map-info__image" src={imageUrl} alt="" />
            </SectorNavLink>
          )
        ) : null}
        <div className="sector-map-info__details">
          <SectorCoordinates sector={sector} geoEditor={geoEditor} />
          {editing && geoEditor ? (
            <>
              <p className="sector-map-info__hint">
                <MdInfoOutline className="sector-map-info__hint-icon" aria-hidden="true" />
                <span>{SECTOR_MARKER_DRAG_HINT}</span>
              </p>
              <div className="sector-map-info__edit-actions">
                <Button
                  type="button"
                  size="sm"
                  variant="primary"
                  aria-label={`Save sector ${displayName}`}
                  disabled={snapshot.saving}
                  onMouseDown={keepCoordinateFocus}
                  onClick={(event) => {
                    keepCoordinateFocus(event);
                    geoEditor.apply();
                  }}
                >
                  Save
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  aria-label={`Cancel sector edit for ${displayName}`}
                  disabled={snapshot.saving}
                  onMouseDown={keepCoordinateFocus}
                  onClick={(event) => {
                    keepCoordinateFocus(event);
                    geoEditor.cancel();
                  }}
                >
                  Cancel
                </Button>
              </div>
            </>
          ) : (
            <div className="sector-map-info__routes">
              {visible.map((route) => (
                <div key={`${route.name}-${route.grade}`} className="sector-map-info__route">
                  {route.name}, {route.grade}
                </div>
              ))}
              {remaining > 0 && (
                <SectorNavLink
                  to={sectorPath}
                  className="sector-map-info__more"
                  navigate={navigate}
                >
                  and {remaining} more...
                </SectorNavLink>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export { SECTOR_MAP_INFO_MAX_ROUTES };

export function renderSectorMapInfo(
  root: Root,
  props: SectorMapInfoProps,
  cragContext: CragContextType,
): void {
  root.render(
    <CragContext.Provider value={cragContext}>
      <SectorMapInfo {...props} />
    </CragContext.Provider>,
  );
}

export default SectorMapInfo;
