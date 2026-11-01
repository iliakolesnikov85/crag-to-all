import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { uploadCragImage } from '../api/client';
import { canEditCrag } from '../api/permissions';
import { useCreateSector, usePatchSectorGeo } from '../api/useCragMutations';
import { useCrag } from '../context/CragContext';
import { useIsMobileLayout } from '../hooks/useIsMobileLayout';
import { useLeafletMap } from '../hooks/useLeafletMap';
import { useLocationTracking } from '../hooks/useLocationTracking';
import { useMapFullscreen } from '../hooks/useMapFullscreen';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { usePlacementMode } from '../hooks/usePlacementMode';
import { useSectorEditor } from '../hooks/useSectorEditor';
import { useSectorMarkers, type SectorMarkerEdit } from '../hooks/useSectorMarkers';
import { useStaticOverlays } from '../hooks/useStaticOverlays';
import { CragData, Sector } from '../types';
import {
  DRAFT_SECTOR_ID,
  DRAFT_SECTOR_LABEL,
  fitMapToCragBounds,
  sectorMarkerKey,
} from '../utils/map';
import MapAnchoredCard from './map/MapAnchoredCard';
import MapControlPortal from './map/MapControlPortal';
import MapToolbar from './map/MapToolbar';
import SectorMapInfo from './map/SectorMapInfo';

interface MapWidgetProps {
  cragData: CragData;
  onSectorGeoSaved?: (sector: Sector) => void;
  onSectorCreated?: (sector: Sector) => void;
}

const MapWidget: React.FC<MapWidgetProps> = ({ cragData, onSectorGeoSaved, onSectorCreated }) => {
  const { crag } = useCrag();
  const online = useOnlineStatus();
  const isMobile = useIsMobileLayout();
  const patchSectorGeo = usePatchSectorGeo(crag.cragId);
  const createSectorMutation = useCreateSector(crag.cragId);
  const mapRef = useRef<HTMLDivElement>(null);
  const map = useLeafletMap(mapRef, { cragId: crag.cragId, cragData, online });
  const { fullscreen, toggleFullscreen } = useMapFullscreen(crag.cragId, map);
  const location = useLocationTracking(map);
  /** Marker key of the sector whose card is open. */
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [placing, setPlacing] = useState(false);
  const placingRef = useRef(placing);
  placingRef.current = placing;
  const onSectorGeoSavedRef = useRef(onSectorGeoSaved);
  const onSectorCreatedRef = useRef(onSectorCreated);
  onSectorGeoSavedRef.current = onSectorGeoSaved;
  onSectorCreatedRef.current = onSectorCreated;

  const canEdit = canEditCrag({
    cragId: crag.cragId,
    source: cragData.source ?? crag.source,
  });

  const editor = useSectorEditor({
    map,
    sectors: cragData.sectors,
    saveSector: (sector, patch) => {
      if (!sector.id || typeof sector.version !== 'number') {
        return Promise.reject(new Error('This sector cannot be saved because it has no id or version.'));
      }
      return patchSectorGeo.mutateAsync({ sectorId: sector.id, version: sector.version, patch });
    },
    createSector: async (input, topo) => {
      const images = topo ? [await uploadCragImage(crag.cragId, topo)] : undefined;
      return createSectorMutation.mutateAsync({ ...input, ...(images ? { images } : {}) });
    },
    onSaved: (sector) => onSectorGeoSavedRef.current?.(sector),
    onCreated: (sector) => {
      setSelectedId(sector.id ?? null);
      onSectorCreatedRef.current?.(sector);
    },
  });
  const edit = editor.state;

  // Position comes from `markerEdit`, not this object, so the reference can stay
  // stable while the pin is dragged (rebuilding it would replace the icon).
  const draftSector = useMemo<Sector | null>(() => {
    if (edit?.target !== DRAFT_SECTOR_ID) return null;
    return { id: DRAFT_SECTOR_ID, name: DRAFT_SECTOR_LABEL, geo: edit.originalGeo, routes: [], images: [] };
  }, [edit?.target, edit?.originalGeo]);
  const markerSectors = useMemo(
    () => (draftSector ? [...cragData.sectors, draftSector] : cragData.sectors),
    [cragData.sectors, draftSector],
  );
  const markerEdit = useMemo<SectorMarkerEdit | null>(
    () => (edit ? { key: edit.target, geo: edit.currentGeo, dragging: edit.dragging } : null),
    [edit?.target, edit?.currentGeo, edit?.dragging],
  );

  useSectorMarkers(map, markerSectors, markerEdit, {
    onSelect: setSelectedId,
    onDragStart: editor.beginDrag,
    onDrag: editor.moveTo,
    onDragEnd: editor.endDrag,
  });
  useStaticOverlays(map, cragData.markers, cragData.trails);
  usePlacementMode(map, placing, {
    onPlace(geo) {
      setPlacing(false);
      editor.startDraft(geo);
      setSelectedId(DRAFT_SECTOR_ID);
    },
    onCancel() {
      setPlacing(false);
    },
  });

  // A click on the map background closes the card. While placing, that click drops the draft instead.
  useEffect(() => {
    if (!map) return;
    const handleMapClick = () => {
      if (placingRef.current) return;
      setSelectedId(null);
    };
    map.on('click', handleMapClick);
    return () => {
      map.off('click', handleMapClick);
    };
  }, [map]);

  // The card hosts the edit. Closing it, or opening another sector, ends the edit.
  const editTarget = edit?.target ?? null;
  const editorRef = useRef(editor);
  editorRef.current = editor;
  useEffect(() => {
    if (editTarget != null && editTarget !== selectedId) editorRef.current.dismiss();
  }, [editTarget, selectedId]);

  // The draft disappears when its edit ends (saved, cancelled, or dismissed).
  useEffect(() => {
    if (selectedId === DRAFT_SECTOR_ID && editTarget !== DRAFT_SECTOR_ID) setSelectedId(null);
  }, [selectedId, editTarget]);

  const togglePlacing = useCallback(() => {
    if (!placingRef.current) setSelectedId(null);
    setPlacing(!placingRef.current);
  }, []);

  const selectedSector = useMemo(() => {
    if (selectedId == null) return null;
    if (selectedId === DRAFT_SECTOR_ID) return draftSector;
    return cragData.sectors.find((sector) => sectorMarkerKey(sector) === selectedId) ?? null;
  }, [selectedId, draftSector, cragData.sectors]);
  const selectedIsDraft = selectedSector?.id === DRAFT_SECTOR_ID;
  const cardGeo = edit && selectedId === edit.target ? edit.currentGeo : selectedSector?.geo ?? null;
  const cardHidden = edit != null && edit.dragging && edit.target === selectedId;

  const card = selectedSector && (
    <SectorMapInfo
      sector={selectedSector}
      editor={editor}
      editable={canEdit}
      isNew={selectedIsDraft}
    />
  );

  return (
    <div className={`map-widget${fullscreen ? ' map-widget--fullscreen' : ''}`}>
      <div ref={mapRef} className="map-container" />
      <MapControlPortal map={map} position="topleft" className="map-toolbar">
        <MapToolbar
          fullscreen={fullscreen}
          onToggleFullscreen={toggleFullscreen}
          locationStatus={location.status}
          onLocate={location.start}
          onResetBounds={() => {
            if (map) fitMapToCragBounds(map, cragData);
          }}
          canAddSector={canEdit}
          placing={placing}
          onTogglePlacing={togglePlacing}
        />
      </MapControlPortal>
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
      {card && isMobile && (
        <div className={`sector-map-info-panel${cardHidden ? ' sector-map-info-panel--hidden' : ''}`}>
          {card}
        </div>
      )}
      {card && !isMobile && map && cardGeo && (
        <MapAnchoredCard map={map} geo={cardGeo} hidden={cardHidden} onClose={() => setSelectedId(null)}>
          {card}
        </MapAnchoredCard>
      )}
    </div>
  );
};

export default MapWidget;
