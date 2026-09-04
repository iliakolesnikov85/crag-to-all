import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import * as L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { CragData, Sector } from '../types';
import { useCrag } from '../context/CragContext';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { useIsMobileLayout } from '../hooks/useIsMobileLayout';
import { useMapFullscreen } from '../hooks/useMapFullscreen';
import SectorMapInfo from './SectorMapInfo';
import {
  applyInitialMapView,
  attachBaseLayers,
  buildBaseLayerOptions,
  createLocationControl,
  createResetBoundsControl,
  renderMapOverlays,
  saveMapView,
} from '../utils/map';

interface MapWidgetProps {
  cragData: CragData;
}

const MapWidget: React.FC<MapWidgetProps> = ({ cragData }) => {
  const { crag, getUrl } = useCrag();
  const navigate = useNavigate();
  const online = useOnlineStatus();
  const isMobile = useIsMobileLayout();
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const overlayRef = useRef<L.LayerGroup | null>(null);
  const skipNextMapClickRef = useRef(false);
  const [mapReady, setMapReady] = useState(false);
  const [selectedSector, setSelectedSector] = useState<Sector | null>(null);
  const { fullscreen, createFullScreenControl } = useMapFullscreen(
    crag.cragId,
    mapInstanceRef,
    mapReady,
  );

  const onSectorSelect = useCallback((sector: Sector) => {
    // Ignore a map click that may fire in the same gesture as the marker click.
    skipNextMapClickRef.current = true;
    setSelectedSector(sector);
    queueMicrotask(() => {
      skipNextMapClickRef.current = false;
    });
  }, []);

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

  // Draw sectors, markers, and trails.
  useEffect(() => {
    if (!mapReady || !overlayRef.current) return;
    renderMapOverlays(overlayRef.current, cragData, navigate, {
      mode: isMobile ? 'bottom-panel' : 'popup',
      onSectorSelect,
      cragContext: { crag, getUrl },
    });
  }, [mapReady, cragData, getUrl, navigate, isMobile, onSectorSelect, crag]);

  return (
    <div className={`map-widget${fullscreen ? ' map-widget--fullscreen' : ''}`}>
      <div ref={mapRef} className="map-container" />
      {isMobile && selectedSector && (
        <div className="sector-map-info-panel">
          <SectorMapInfo sector={selectedSector} />
        </div>
      )}
    </div>
  );
};

export default MapWidget;
