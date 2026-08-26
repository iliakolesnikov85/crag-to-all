import React from 'react';
import './MapPage.scss';
import { CragData, Sector } from '../types';
import { RoutesFilter, MapWidget } from '../components';
import { setBodyScrollLock } from '../utils/bodyScrollLock';

interface MapPageProps {
  cragData: CragData;
}

const MapPage: React.FC<MapPageProps> = ({ cragData }) => {
  const [filteredSectors, setFilteredSectors] = React.useState<Sector[]>(cragData.sectors);

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
      
      <MapWidget cragData={mapCragData} />
    </div>
  );
};

export default MapPage;
