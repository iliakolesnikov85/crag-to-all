import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { uploadCragImage } from '../api/client';
import { canEditCrag } from '../api/permissions';
import { useCreateSector, usePatchCrag, usePatchSector } from '../api/useCragMutations';
import { useCrag } from '../context/CragContext';
import { useIsMobileLayout } from '../hooks/useIsMobileLayout';
import { useLeafletMap } from '../hooks/useLeafletMap';
import { useLocationTracking } from '../hooks/useLocationTracking';
import { useMapFullscreen } from '../hooks/useMapFullscreen';
import { useMapMarkers, type MapMarkerEdit } from '../hooks/useMapMarkers';
import { useMarkerEditor } from '../hooks/useMarkerEditor';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { usePlacementMode } from '../hooks/usePlacementMode';
import { useSectorEditor } from '../hooks/useSectorEditor';
import { useSectorMarkers, type SectorMarkerEdit } from '../hooks/useSectorMarkers';
import { useStaticOverlays } from '../hooks/useStaticOverlays';
import { CragData, type CragMapMarker, type LatLng, Sector } from '../types';
import {
  DRAFT_MARKER_KEY,
  DRAFT_SECTOR_ID,
  DRAFT_SECTOR_LABEL,
  fitMapToCragBounds,
  markerKeyFromIndex,
  sectorMarkerKey,
} from '../utils/map';
import MapAnchoredCard from './map/MapAnchoredCard';
import MapControlPortal from './map/MapControlPortal';
import MapToolbar, { type MapPlacementMode } from './map/MapToolbar';
import MarkerMapInfo from './map/MarkerMapInfo';
import SectorMapInfo from './map/SectorMapInfo';

const EMPTY_MARKERS: CragMapMarker[] = [];

interface MapWidgetProps {
  cragData: CragData;
  onSectorGeoSaved?: (sector: Sector) => void;
  onSectorCreated?: (sector: Sector) => void;
}

type OpenCard =
  | { kind: 'sector'; id: string }
  | { kind: 'marker'; key: string };

interface LivePin {
  target: string;
  currentGeo: LatLng;
  dragging: boolean;
}

/** Where the open card sits. A drag keeps the resting point so the hidden card does not follow the pointer. */
function cardPlacement(
  live: LivePin | null,
  openKey: string | null,
  restingGeo: LatLng | null,
): { geo: LatLng | null; hidden: boolean } {
  if (live == null || live.target !== openKey) return { geo: restingGeo, hidden: false };
  if (live.dragging) return { geo: restingGeo, hidden: true };
  return { geo: live.currentGeo, hidden: false };
}

const MapWidget: React.FC<MapWidgetProps> = ({ cragData, onSectorGeoSaved, onSectorCreated }) => {
  const { crag } = useCrag();
  const online = useOnlineStatus();
  const isMobile = useIsMobileLayout();
  const patchSector = usePatchSector(crag.cragId);
  const createSectorMutation = useCreateSector(crag.cragId);
  const patchCrag = usePatchCrag(crag.cragId);
  const mapRef = useRef<HTMLDivElement>(null);
  const map = useLeafletMap(mapRef, { cragId: crag.cragId, cragData, online });
  const { fullscreen, toggleFullscreen } = useMapFullscreen(crag.cragId, map);
  const location = useLocationTracking(map);
  const [openCard, setOpenCard] = useState<OpenCard | null>(null);
  const selectedId = openCard?.kind === 'sector' ? openCard.id : null;
  const selectedMarkerKey = openCard?.kind === 'marker' ? openCard.key : null;
  const [placement, setPlacement] = useState<MapPlacementMode | null>(null);
  const placing = placement != null;

  const canEdit = canEditCrag({
    cragId: crag.cragId,
    source: cragData.source ?? crag.source,
  });
  const markers = cragData.markers ?? EMPTY_MARKERS;

  const editor = useSectorEditor({
    map,
    sectors: cragData.sectors,
    saveSector: (sector, patch) => {
      if (!sector.id || typeof sector.version !== 'number') {
        return Promise.reject(new Error('This sector cannot be saved because it has no id or version.'));
      }
      return patchSector.mutateAsync({ sectorId: sector.id, version: sector.version, patch });
    },
    createSector: async (input, topo) => {
      const images = topo ? [await uploadCragImage(crag.cragId, topo)] : undefined;
      return createSectorMutation.mutateAsync({ ...input, ...(images ? { images } : {}) });
    },
    onSaved: (sector) => onSectorGeoSaved?.(sector),
    onCreated: (sector) => {
      setOpenCard(sector.id != null ? { kind: 'sector', id: sector.id } : null);
      onSectorCreated?.(sector);
    },
  });
  const edit = editor.state;

  const markerEditor = useMarkerEditor({
    map,
    markers,
    version: cragData.version,
    saveMarkers: (next) => {
      if (typeof cragData.version !== 'number') {
        return Promise.reject(new Error('This crag cannot be saved because it has no version.'));
      }
      return patchCrag.mutateAsync({ version: cragData.version, markers: next }).then((saved) => {
        if (!saved.markers) {
          throw new Error('Marker save returned an unexpected response');
        }
        return saved.markers;
      });
    },
    onSaved: (key) => setOpenCard({ kind: 'marker', key }),
    onDeleted: () => setOpenCard(null),
  });
  const markerEdit = markerEditor.state;

  // Draft pins omit the live position so typing or dragging does not rebuild the marker list.
  const draftSector = useMemo<Sector | null>(() => {
    if (edit?.target !== DRAFT_SECTOR_ID) return null;
    return { id: DRAFT_SECTOR_ID, name: DRAFT_SECTOR_LABEL, geo: edit.originalGeo, routes: [], images: [] };
  }, [edit?.target, edit?.originalGeo]);
  const markerSectors = useMemo(
    () => (draftSector ? [...cragData.sectors, draftSector] : cragData.sectors),
    [cragData.sectors, draftSector],
  );
  const draftMarker = useMemo<CragMapMarker | null>(() => {
    if (markerEdit?.target !== DRAFT_MARKER_KEY) return null;
    return { type: markerEdit.markerType, info: '', geo: markerEdit.originalGeo };
  }, [markerEdit?.target, markerEdit?.markerType, markerEdit?.originalGeo]);

  // Position is omitted while dragging: Leaflet owns the pin until the drop.
  const sectorPinGeo = edit != null && !edit.dragging ? edit.currentGeo : null;
  const sectorPinEdit = useMemo<SectorMarkerEdit | null>(() => {
    if (!edit) return null;
    return { key: edit.target, geo: edit.currentGeo, dragging: edit.dragging };
  }, [edit?.target, edit?.dragging, sectorPinGeo]);
  const markerPinGeo = markerEdit != null && !markerEdit.dragging ? markerEdit.currentGeo : null;
  const mapMarkerEdit = useMemo<MapMarkerEdit | null>(() => {
    if (!markerEdit) return null;
    return {
      key: markerEdit.target,
      geo: markerEdit.currentGeo,
      type: markerEdit.markerType,
      dragging: markerEdit.dragging,
    };
  }, [markerEdit?.target, markerEdit?.dragging, markerEdit?.markerType, markerPinGeo]);

  const selectSector = useCallback((id: string) => {
    setOpenCard({ kind: 'sector', id });
  }, []);
  const selectMarker = useCallback((key: string) => {
    setOpenCard({ kind: 'marker', key });
  }, []);

  useSectorMarkers(map, markerSectors, sectorPinEdit, {
    onSelect: selectSector,
    onDragStart: editor.beginDrag,
    onDrag: editor.moveTo,
    onDragEnd: editor.endDrag,
  });
  useMapMarkers(map, markers, draftMarker, mapMarkerEdit, {
    onSelect: selectMarker,
    onDragStart: markerEditor.beginDrag,
    onDrag: markerEditor.moveTo,
    onDragEnd: markerEditor.endDrag,
  });
  useStaticOverlays(map, cragData.trails);
  usePlacementMode(map, placing, {
    onPlace(geo) {
      setPlacement(null);
      if (placement === 'marker') {
        markerEditor.startDraft(geo);
        setOpenCard({ kind: 'marker', key: DRAFT_MARKER_KEY });
        return;
      }
      editor.startDraft(geo);
      setOpenCard({ kind: 'sector', id: DRAFT_SECTOR_ID });
    },
    onCancel() {
      setPlacement(null);
    },
  });

  // A click on the map background closes the card. While placing, that click drops the draft instead.
  useEffect(() => {
    if (!map || placing) return;
    const handleMapClick = () => setOpenCard(null);
    map.on('click', handleMapClick);
    return () => {
      map.off('click', handleMapClick);
    };
  }, [map, placing]);

  // The card hosts the edit. Closing it, or opening another pin, ends the edit.
  // A dismiss during a save is ignored until the save finishes, then retried,
  // so a failure cannot leave a pin editable with no card.
  const editTarget = edit?.target ?? null;
  const sectorSaving = edit?.saving ?? false;
  const editorRef = useRef(editor);
  editorRef.current = editor;
  useEffect(() => {
    if (editTarget != null && editTarget !== selectedId) editorRef.current.dismiss();
    if (selectedId === DRAFT_SECTOR_ID && editTarget !== DRAFT_SECTOR_ID) setOpenCard(null);
  }, [editTarget, selectedId, sectorSaving]);

  const markerEditTarget = markerEdit?.target ?? null;
  const markerSaving = markerEdit?.saving ?? false;
  const markerEditorRef = useRef(markerEditor);
  markerEditorRef.current = markerEditor;
  useEffect(() => {
    if (markerEditTarget != null && markerEditTarget !== selectedMarkerKey) markerEditorRef.current.dismiss();
    if (selectedMarkerKey === DRAFT_MARKER_KEY && markerEditTarget !== DRAFT_MARKER_KEY) setOpenCard(null);
  }, [markerEditTarget, selectedMarkerKey, markerSaving]);

  const togglePlacing = useCallback((mode: MapPlacementMode) => {
    setPlacement((current) => (current === mode ? null : mode));
    setOpenCard(null);
  }, []);

  const selectedSector = useMemo(() => {
    if (selectedId == null) return null;
    if (selectedId === DRAFT_SECTOR_ID) return draftSector;
    return cragData.sectors.find((sector) => sectorMarkerKey(sector) === selectedId) ?? null;
  }, [selectedId, draftSector, cragData.sectors]);
  const selectedMarker = useMemo(() => {
    if (selectedMarkerKey == null) return null;
    if (selectedMarkerKey === DRAFT_MARKER_KEY) {
      if (!draftMarker) return null;
      return { key: DRAFT_MARKER_KEY, index: null, isNew: true, marker: draftMarker };
    }
    const index = markers.findIndex((_, itemIndex) => markerKeyFromIndex(itemIndex) === selectedMarkerKey);
    const marker = markers[index];
    if (index < 0 || !marker) return null;
    return { key: selectedMarkerKey, index, isNew: false, marker };
  }, [selectedMarkerKey, draftMarker, markers]);
  const selectedIsDraft = selectedSector?.id === DRAFT_SECTOR_ID;
  const markerCard = cardPlacement(markerEdit, selectedMarkerKey, selectedMarker?.marker.geo ?? null);
  const sectorCard = cardPlacement(edit, selectedId, selectedSector?.geo ?? null);
  const cardGeo = selectedMarker ? markerCard.geo : sectorCard.geo;
  const cardHidden = selectedMarker ? markerCard.hidden : sectorCard.hidden;

  const card = selectedMarker ? (
    <MarkerMapInfo
      markerKey={selectedMarker.key}
      marker={selectedMarker.marker}
      index={selectedMarker.index}
      editor={markerEditor}
      editable={canEdit}
      isNew={selectedMarker.isNew}
    />
  ) : selectedSector && (
    <SectorMapInfo
      sector={selectedSector}
      editor={editor}
      editable={canEdit}
      isNew={selectedIsDraft}
    />
  );

  const closeCard = useCallback(() => setOpenCard(null), []);

  const placementSubject = placement === 'marker' ? 'marker' : 'sector';

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
          canAdd={canEdit}
          placing={placement}
          onTogglePlacing={togglePlacing}
        />
      </MapControlPortal>
      {placing && (
        <div className="map-placement-hint" role="status">
          <span className="map-placement-hint__text">
            {isMobile
              ? `Tap the map where the new ${placementSubject} should be`
              : `Click the map where the new ${placementSubject} should be`}
          </span>
          <button
            type="button"
            className="map-placement-hint__cancel"
            onClick={() => setPlacement(null)}
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
        <MapAnchoredCard
          map={map}
          geo={cardGeo}
          hidden={cardHidden}
          label={selectedMarker ? 'Map marker' : 'Sector details'}
          className={selectedMarker ? 'sector-map-card--marker' : undefined}
          onClose={closeCard}
        >
          {card}
        </MapAnchoredCard>
      )}
    </div>
  );
};

export default MapWidget;
