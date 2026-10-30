import React, { useEffect, useRef, useState } from 'react';
import * as L from 'leaflet';
import { useIsMobileLayout } from '../../hooks/useIsMobileLayout';
import { createAddSectorControl, type AddSectorControl } from '../../utils/map';

const PLACING_CLASS = 'leaflet-placing-sector';

interface PlaceSectorMapButtonProps {
  map: L.Map | null;
  /** Called when placement starts, e.g. to clear a selected sector. */
  onStart?: () => void;
}

/** Add-sector map button. Toggles a mode where the next map click picks the new sector's location. */
const PlaceSectorMapButton: React.FC<PlaceSectorMapButtonProps> = ({ map, onStart }) => {
  const isMobile = useIsMobileLayout();
  const [placing, setPlacing] = useState(false);
  const controlRef = useRef<AddSectorControl | null>(null);
  const onStartRef = useRef(onStart);
  onStartRef.current = onStart;

  useEffect(() => {
    if (!map) return;
    const AddSectorControl = createAddSectorControl(() => {
      setPlacing((current) => !current);
    });
    const control = new AddSectorControl().addTo(map);
    controlRef.current = control;
    return () => {
      control.remove();
      controlRef.current = null;
      setPlacing(false);
    };
  }, [map]);

  useEffect(() => {
    controlRef.current?.setActive(placing);
    if (!placing || !map) return;
    const container = map.getContainer();
    map.closePopup();
    onStartRef.current?.();
    L.DomUtil.addClass(container, PLACING_CLASS);
    const stopPlacing = () => {
      setPlacing(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.stopPropagation();
      stopPlacing();
    };
    map.on('click', stopPlacing);
    // Capture on window so Esc cancels placement without also leaving fullscreen.
    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      L.DomUtil.removeClass(container, PLACING_CLASS);
      map.off('click', stopPlacing);
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [map, placing]);

  if (!placing) return null;

  return (
    <div className="map-placement-hint" role="status">
      <span className="map-placement-hint__text">
        {isMobile
          ? 'Tap the map where the new sector should be'
          : 'Click the map where the new sector should be'}
      </span>
      <button
        type="button"
        className="map-placement-hint__cancel"
        onClick={() => setPlacing(false)}
      >
        Cancel
      </button>
    </div>
  );
};

export default PlaceSectorMapButton;
