import React from 'react';
import './MapPage.scss';
import { CragData, Sector } from '../types';
import { RoutesFilter, MapWidget } from '../components';
import { setBodyScrollLock } from '../utils/bodyScrollLock';

interface MapPageProps {
  cragData: CragData;
  onSectorGeoSaved?: (sector: Sector) => void;
}

const MapPage: React.FC<MapPageProps> = ({ cragData, onSectorGeoSaved }) => {
  const [filteredSectors, setFilteredSectors] = React.useState<Sector[]>(cragData.sectors);

  const handleSectorGeoSaved = React.useCallback((sector: Sector) => {
    setFilteredSectors((current) =>
      current.map((item) => (sector.id != null && item.id === sector.id ? sector : item)),
    );
    onSectorGeoSaved?.(sector);
  }, [onSectorGeoSaved]);

  // Map fills the viewport; body scroll only causes rubber-banding / accidental pans.
  React.useEffect(() => {
    setBodyScrollLock(true);
    return () => setBodyScrollLock(false);
  }, []);

  const mapCragData = React.useMemo(
    () => ({ ...cragData, sectors: filteredSectors }),
    [cragData, filteredSectors]
  );

  return (
    <div className="map-page page no-padding-mobile">
      
      {/* Route Filter Section */}
      <RoutesFilter
        sectors={cragData.sectors}
        onFilteredSectorsChange={setFilteredSectors}
      />
      
      <MapWidget cragData={mapCragData} onSectorGeoSaved={handleSectorGeoSaved} />
    </div>
  );
};

export default MapPage;
