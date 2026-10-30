import React, { useEffect, useImperativeHandle, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import * as L from 'leaflet';
import { createSector } from '../../api/client';
import { useCrag } from '../../context/CragContext';
import { useIsMobileLayout } from '../../hooks/useIsMobileLayout';
import type { LatLng, Sector } from '../../types';
import {
  addDraftSectorMarker,
  createAddSectorControl,
  type AddSectorControl,
  type DraftSectorMarker,
} from '../../utils/map';
import SectorMapInfo from './SectorMapInfo';

const PLACING_CLASS = 'leaflet-placing-sector';

interface PlaceSectorMapButtonProps {
  map: L.Map | null;
  /** Names already used by sectors on this crag, so the draft can reject duplicates. */
  takenNames: readonly string[];
  /** Called when placement starts, e.g. to clear a selected sector. */
  onStart?: () => void;
  /** Called after the new sector has been saved. */
  onCreated?: (sector: Sector) => void;
}

interface PlaceSectorMapButtonHandle {
  /** Drop the unsaved marker, e.g. when another sector is selected. */
  dismiss(): void;
}

/** Add-sector map button. The next map click drops a draft sector marker for editing. */
const PlaceSectorMapButton = React.forwardRef<PlaceSectorMapButtonHandle, PlaceSectorMapButtonProps>(
  function PlaceSectorMapButton({ map, takenNames, onStart, onCreated }, ref) {
    const { crag, getUrl } = useCrag();
    const navigate = useNavigate();
    const isMobile = useIsMobileLayout();
    const [placing, setPlacing] = useState(false);
    const [draft, setDraft] = useState<DraftSectorMarker | null>(null);
    const [draftDragging, setDraftDragging] = useState(false);
    const controlRef = useRef<AddSectorControl | null>(null);
    const draftRef = useRef<DraftSectorMarker | null>(null);
    // The placing effect and an in-flight save both outlive this render.
    const onStartRef = useRef(onStart);
    const onCreatedRef = useRef(onCreated);
    onStartRef.current = onStart;
    onCreatedRef.current = onCreated;

    useImperativeHandle(ref, () => ({
      dismiss() {
        draftRef.current?.remove();
      },
    }), []);

    // Rewritten each render so the map-click listener, bound only while placing, calls the latest one.
    const placeDraftRef = useRef<(geo: LatLng) => void>(() => {});
    placeDraftRef.current = (geo) => {
      if (!map) return;
      draftRef.current?.remove();
      const placed = addDraftSectorMarker({
        map,
        geo,
        mode: isMobile ? 'bottom-panel' : 'popup',
        takenNames,
        cragContext: { crag, getUrl },
        navigate,
        createSector: (sector) => createSector(crag.cragId, sector),
        onCreated: (sector) => onCreatedRef.current?.(sector),
        onClose: () => {
          if (draftRef.current !== placed) return;
          draftRef.current = null;
          setDraft(null);
          setDraftDragging(false);
        },
        onDragChange: setDraftDragging,
      });
      draftRef.current = placed;
      setDraft(placed);
    };

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
        draftRef.current?.remove();
      };
    }, [map]);

    useEffect(() => {
      controlRef.current?.setActive(placing);
      if (!placing || !map) return;
      const container = map.getContainer();
      map.closePopup();
      draftRef.current?.remove();
      onStartRef.current?.();
      L.DomUtil.addClass(container, PLACING_CLASS);
      const handleMapClick = (event: L.LeafletMouseEvent) => {
        setPlacing(false);
        placeDraftRef.current({ lat: event.latlng.lat, lon: event.latlng.lng });
      };
      const handleKeyDown = (event: KeyboardEvent) => {
        if (event.key !== 'Escape') return;
        event.stopPropagation();
        setPlacing(false);
      };
      map.on('click', handleMapClick);
      // Capture on window so Esc cancels placement without also leaving fullscreen.
      window.addEventListener('keydown', handleKeyDown, true);
      return () => {
        L.DomUtil.removeClass(container, PLACING_CLASS);
        map.off('click', handleMapClick);
        window.removeEventListener('keydown', handleKeyDown, true);
      };
    }, [map, placing]);

    // A background tap discards the draft. The click that placed it happens before
    // this listener exists, so it does not discard the marker it just created.
    useEffect(() => {
      if (!map || !isMobile || !draft) return;
      const handleMapClick = () => {
        draftRef.current?.editor.dismiss();
      };
      map.on('click', handleMapClick);
      return () => {
        map.off('click', handleMapClick);
      };
    }, [map, isMobile, draft]);

    // A draft is shown either in a popup or in the bottom panel. Drop it when the
    // layout switches.
    useEffect(() => {
      return () => {
        draftRef.current?.remove();
      };
    }, [isMobile]);

    return (
      <>
        {placing && (
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
        )}
        {isMobile && draft && !draftDragging && (
          <div className="sector-map-info-panel">
            <SectorMapInfo sector={draft.sector} geoEditor={draft.editor} isNew />
          </div>
        )}
      </>
    );
  },
);

export type { PlaceSectorMapButtonHandle };

export default PlaceSectorMapButton;
