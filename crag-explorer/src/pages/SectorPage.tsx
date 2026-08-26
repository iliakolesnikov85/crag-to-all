import React from 'react';
import { useParams } from 'react-router';
import SectorView from '../components/SectorView';
import { Sector } from '../types';
import { useCrag } from '../context/CragContext';
import { getCragImageUrl } from '../utils/firebaseStorage';
import { createSectorViewLink } from '../utils/createSectorViewLink';

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
        createLink={createSectorViewLink(getUrl, crag.cragId, sector.geo)}
      />
    </div>
  );
};

export default SectorPage; 