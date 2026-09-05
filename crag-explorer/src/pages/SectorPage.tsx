import React from 'react';
import { Link, useParams } from 'react-router';
import SectorView from '../components/SectorView';
import { Sector } from '../types';
import { useCrag } from '../context/CragContext';
import { getCragImageUrl } from '../utils/firebaseStorage';
import { setMapCenter } from '../utils/map';

interface SectorPageProps {
  sectors: Sector[];
  onSectorChange?: (sectorName: string | undefined) => void;
}

const SectorPage: React.FC<SectorPageProps> = ({ sectors, onSectorChange }) => {
  const { sectorName } = useParams<{ sectorName: string }>();
  const { crag, getUrl } = useCrag();

  React.useEffect(() => {
    if (onSectorChange) {
      onSectorChange(sectorName);
    }
  }, [sectorName, onSectorChange]);

  const sector = sectors.find(s => s.name.toLowerCase() === (sectorName || '').toLowerCase());

  if (!sector) return <div className="page">Sector not found.</div>;

  return (
    <div className="page">
      <SectorView
        cragId={crag.cragId}
        sector={sector}
        getImageUrl={getCragImageUrl}
        createLink={(to: string, children: React.ReactNode) => (
          <Link
            className="link"
            to={getUrl(to)}
            onClick={() => {
              if (to !== '/map') return;
              if (sector?.geo) setMapCenter(crag.cragId, [sector?.geo.lat, sector?.geo.lon], 17);
            }}
          >
            {children}
          </Link>
        )}
      />
    </div>
  );
};

export default SectorPage; 