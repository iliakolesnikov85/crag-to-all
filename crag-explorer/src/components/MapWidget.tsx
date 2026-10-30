import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import * as L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { patchSectorGeo } from '../api/client';
import { canEditCrag } from '../api/permissions';
import { CragData, Sector } from '../types';
import { useCrag } from '../context/CragContext';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { useIsMobileLayout } from '../hooks/useIsMobileLayout';
import { useMapFullscreen } from '../hooks/useMapFullscreen';
import PlaceSectorMapButton from './map/PlaceSectorMapButton';
import SectorMapInfo from './map/SectorMapInfo';
import {
  applyInitialMapView,
  attachBaseLayers,
  buildBaseLayerOptions,
  createLocationControl,
  createResetBoundsControl,
  mapOverlayRenderKey,
  renderMapOverlays,
  saveMapView,
  type SectorEditPatch,
  type SectorGeoEditor,
} from '../utils/map';

interface MapWidgetProps {
  cragData: CragData;
  onSectorGeoSaved?: (sector: Sector) => void;
}

const MapWidget: React.FC<MapWidgetProps> = ({ cragData, onSectorGeoSaved }) => {
  const { crag, getUrl } = useCrag();
  const navigate = useNavigate();
  const online = useOnlineStatus();
  const isMobile = useIsMobileLayout();
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const overlayRef = useRef<L.LayerGroup | null>(null);
  const overlayKeyRef = useRef('');
  const mapSeenRef = useRef<L.Map | null>(null);
  const reopenSectorIdRef = useRef<string | null>(null);
  const getUrlRef = useRef(getUrl);
  const navigateRef = useRef(navigate);
  const onSectorGeoSavedRef = useRef(onSectorGeoSaved);
  const skipNextMapClickRef = useRef(false);
  const [mapReady, setMapReady] = useState(false);
  const [mapEpoch, setMapEpoch] = useState(0);
  const [selectedSector, setSelectedSector] = useState<Sector | null>(null);
  const [sectorEditors, setSectorEditors] = useState<ReadonlyMap<string, SectorGeoEditor>>(new Map());
  const [draggingSectorId, setDraggingSectorId] = useState<string | null>(null);
  const { fullscreen, createFullScreenControl } = useMapFullscreen(
    crag.cragId,
    mapInstanceRef,
    mapReady,
  );

  getUrlRef.current = getUrl;
  navigateRef.current = navigate;
  onSectorGeoSavedRef.current = onSectorGeoSaved;

  const onSectorSelect = useCallback((sector: Sector) => {
    // Ignore a map click that may fire in the same gesture as the marker click.
    skipNextMapClickRef.current = true;
    setSelectedSector(sector);
    queueMicrotask(() => {
      skipNextMapClickRef.current = false;
    });
  }, []);

  const clearSelectedSector = useCallback(() => {
    setSelectedSector(null);
  }, []);

  const handleSectorGeoSaved = useCallback((sector: Sector) => {
    if (sector.id) reopenSectorIdRef.current = sector.id;
    setSelectedSector((current) =>
      current && sector.id != null && current.id === sector.id ? sector : current,
    );
    onSectorGeoSavedRef.current?.(sector);
  }, []);

  const handleSectorDragChange = useCallback((sectorId: string, dragging: boolean) => {
    setDraggingSectorId((current) => {
      if (dragging) return sectorId;
      return current === sectorId ? null : current;
    });
  }, []);

  const saveSectorGeo = useCallback((sector: Sector, patch: SectorEditPatch) => {
    if (!sector.id || typeof sector.version !== 'number') {
      return Promise.reject(new Error('This sector cannot be saved because it has no id or version.'));
    }
    return patchSectorGeo(crag.cragId, sector.id, sector.version, patch);
  }, [crag.cragId]);

  // Create map instance, controls, and base layers.
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    let cancelled = false;
    const map = L.map(mapRef.current);
    mapInstanceRef.current = map;
    overlayRef.current = L.layerGroup().addTo(map);

    void buildBaseLayerOptions(crag.cragId, online).then((options) => {
      if (cancelled) return;
      attachBaseLayers(map, options);
    });

    const FullScreenControl = createFullScreenControl();
    const LocationControl = createLocationControl();
    const ResetBoundsControl = createResetBoundsControl(cragData);
    const fullScreenControl = new FullScreenControl().addTo(map);
    const locationControl = new LocationControl().addTo(map);
    const resetBoundsControl = new ResetBoundsControl().addTo(map);

    const handleViewChange = () => {
      if (mapInstanceRef.current) {
        saveMapView(crag.cragId, mapInstanceRef.current);
      }
    };
    map.on('moveend', handleViewChange);
    map.on('zoomend', handleViewChange);

    applyInitialMapView(map, crag.cragId, cragData);
    setMapEpoch((epoch) => epoch + 1);
    setMapReady(true);

    return () => {
      cancelled = true;
      map.off('moveend', handleViewChange);
      map.off('zoomend', handleViewChange);
      if (mapInstanceRef.current) {
        saveMapView(crag.cragId, mapInstanceRef.current);
      }
      setMapReady(false);
      overlayRef.current = null;
      locationControl.remove();
      fullScreenControl.remove();
      resetBoundsControl.remove();
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [online, crag.cragId]);

  // Dismiss bottom panel when tapping the map background.
  useEffect(() => {
    if (!isMobile) setSelectedSector(null);
    if (!mapReady || !mapInstanceRef.current || !isMobile) return;
    const map = mapInstanceRef.current;
    const handleMapClick = () => {
      if (skipNextMapClickRef.current) return;
      setSelectedSector(null);
    };
    map.on('click', handleMapClick);
    return () => {
      map.off('click', handleMapClick);
    };
  }, [mapReady, isMobile]);

  const canEditSectorGeo = canEditCrag({
    cragId: crag.cragId,
    source: cragData.source ?? crag.source,
  });

  // Draw sectors, markers, and trails. Skip when only the React tree changed so an
  // open editor is not torn down. A coordinate save also keeps the current pin,
  // because rebuilding it would close the popup.
  useEffect(() => {
    const overlay = overlayRef.current;
    const map = mapInstanceRef.current;
    if (!mapReady || !overlay || !map) {
      overlayKeyRef.current = '';
      mapSeenRef.current = null;
      setSectorEditors((current) => (current.size === 0 ? current : new Map()));
      return;
    }
    if (mapSeenRef.current !== map) {
      overlayKeyRef.current = '';
      mapSeenRef.current = map;
    }
    const mode = isMobile ? 'bottom-panel' : 'popup';
    const key = `${crag.cragId}:${canEditSectorGeo ? 'edit' : 'view'}:${mode}:${mapOverlayRenderKey(cragData)}`;
    if (key === overlayKeyRef.current) {
      reopenSectorIdRef.current = null;
      return;
    }
    const reopenId = reopenSectorIdRef.current;
    reopenSectorIdRef.current = null;
    // A coordinate save already moved this pin. Rebuilding the layers would
    // close its popup, so keep the current marker and the open popup.
    if (reopenId && mode === 'popup' && overlayKeyRef.current) {
      overlayKeyRef.current = key;
      return;
    }
    overlayKeyRef.current = key;
    const editors = new Map<string, SectorGeoEditor>();
    renderMapOverlays(overlay, cragData, (to) => navigateRef.current(to), {
      mode,
      onSectorSelect,
      cragContext: {
        crag,
        getUrl: (url: string) => getUrlRef.current(url),
      },
      map,
      canEditSectorGeo,
      editors,
      openPopupForSectorId: mode === 'popup' ? reopenId : null,
      onSectorGeoSaved: handleSectorGeoSaved,
      onSectorDragChange: handleSectorDragChange,
      saveSectorGeo,
    });
    setSectorEditors(editors);
  }, [
    mapReady,
    cragData,
    isMobile,
    onSectorSelect,
    crag,
    canEditSectorGeo,
    handleSectorGeoSaved,
    handleSectorDragChange,
    saveSectorGeo,
    mapEpoch,
  ]);

  // The bottom panel has no popup to close. Selecting another sector, or tapping
  // the map to clear the selection, ends the edit instead.
  const selectedSectorId = selectedSector?.id ?? null;
  useEffect(() => {
    if (!isMobile) return;
    for (const [sectorId, editor] of sectorEditors) {
      if (sectorId !== selectedSectorId) editor.dismiss();
    }
  }, [isMobile, selectedSectorId, sectorEditors]);

  const selectedEditor = selectedSector?.id
    ? sectorEditors.get(selectedSector.id) ?? null
    : null;
  const hideSelectedPanel = selectedSector?.id != null && draggingSectorId === selectedSector.id;

  return (
    <div className={`map-widget${fullscreen ? ' map-widget--fullscreen' : ''}`}>
      <div ref={mapRef} className="map-container" />
      {canEditSectorGeo && (
        <PlaceSectorMapButton
          map={mapReady ? mapInstanceRef.current : null}
          onStart={clearSelectedSector}
        />
      )}
      {isMobile && selectedSector && !hideSelectedPanel && (
        <div className="sector-map-info-panel">
          <SectorMapInfo sector={selectedSector} geoEditor={selectedEditor} />
        </div>
      )}
    </div>
  );
};

export default MapWidget;
