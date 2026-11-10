import React from 'react';
import {
  MdAddLocation,
  MdErrorOutline,
  MdFullscreen,
  MdFullscreenExit,
  MdHome,
  MdHourglassEmpty,
  MdLocationSearching,
  MdOutlineMyLocation,
} from 'react-icons/md';
import type { LocationTrackingStatus } from '../../hooks/useLocationTracking';
import { createPieChartSVG } from '../../utils/grades';

const ADD_SECTOR_PIE_SVG = createPieChartSVG({ '6A': 1, '6B': 1, '6C': 1, '7A': 1 }, 20);

const LOCATION_TITLES: Record<LocationTrackingStatus, string> = {
  off: 'Show My Location',
  loading: 'Getting location...',
  on: 'Center on my location',
  error: 'Location unavailable',
};

type MapPlacementMode = 'sector' | 'marker';

interface MapToolbarProps {
  fullscreen: boolean;
  onToggleFullscreen(): void;
  locationStatus: LocationTrackingStatus;
  onLocate(): void;
  onResetBounds(): void;
  /** Show the add-sector and add-marker toggles. */
  canAdd: boolean;
  placing: MapPlacementMode | null;
  onTogglePlacing(mode: MapPlacementMode): void;
}

function LocationIcon({ status }: { status: LocationTrackingStatus }) {
  switch (status) {
    case 'loading':
      return <MdHourglassEmpty size={18} />;
    case 'on':
      return <MdOutlineMyLocation size={18} />;
    case 'error':
      return <MdErrorOutline size={18} />;
    default:
      return <MdLocationSearching size={18} />;
  }
}

/** Buttons stacked under the zoom control: fullscreen, my location, reset bounds, add sector, add marker. */
const MapToolbar: React.FC<MapToolbarProps> = ({
  fullscreen,
  onToggleFullscreen,
  locationStatus,
  onLocate,
  onResetBounds,
  canAdd,
  placing,
  onTogglePlacing,
}) => (
  <>
    <button
      type="button"
      className="map-toolbar__button"
      title={fullscreen ? 'Exit Fullscreen' : 'View Fullscreen'}
      aria-label={fullscreen ? 'Exit Fullscreen' : 'View Fullscreen'}
      aria-pressed={fullscreen}
      onClick={onToggleFullscreen}
    >
      {fullscreen ? <MdFullscreenExit size={18} /> : <MdFullscreen size={18} />}
    </button>
    <button
      type="button"
      className="map-toolbar__button"
      title={LOCATION_TITLES[locationStatus]}
      aria-label={LOCATION_TITLES[locationStatus]}
      onClick={onLocate}
    >
      <LocationIcon status={locationStatus} />
    </button>
    <button
      type="button"
      className="map-toolbar__button"
      title="Reset to crag bounds"
      aria-label="Reset to crag bounds"
      onClick={onResetBounds}
    >
      <MdHome size={18} />
    </button>
    {canAdd && (
      <button
        type="button"
        className={`map-toolbar__button${placing === 'sector' ? ' map-toolbar__button--active' : ''}`}
        title={placing === 'sector' ? 'Cancel adding sector' : 'Add sector'}
        aria-label={placing === 'sector' ? 'Cancel adding sector' : 'Add sector'}
        aria-pressed={placing === 'sector'}
        onClick={() => onTogglePlacing('sector')}
      >
        <span className="add-sector-icon" aria-hidden="true">
          <span dangerouslySetInnerHTML={{ __html: ADD_SECTOR_PIE_SVG }} />
          <svg className="add-sector-icon__plus" width="11" height="11" viewBox="0 0 11 11" xmlns="http://www.w3.org/2000/svg" focusable="false">
            <circle cx="5.5" cy="5.5" r="5" fill="#1565c0" stroke="#fff" strokeWidth="1" />
            <path d="M5.5 3v5M3 5.5h5" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </span>
      </button>
    )}
    {canAdd && (
      <button
        type="button"
        className={`map-toolbar__button${placing === 'marker' ? ' map-toolbar__button--active' : ''}`}
        title={placing === 'marker' ? 'Cancel adding marker' : 'Add marker'}
        aria-label={placing === 'marker' ? 'Cancel adding marker' : 'Add marker'}
        aria-pressed={placing === 'marker'}
        onClick={() => onTogglePlacing('marker')}
      >
        <MdAddLocation size={18} />
      </button>
    )}
  </>
);

export type { MapPlacementMode };

export default MapToolbar;
