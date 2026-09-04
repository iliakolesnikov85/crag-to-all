import React from 'react';
import { useParams } from 'react-router';
import SectorView from '../components/SectorView';
import { Sector } from '../types';
import { useCrag } from '../context/CragContext';
import { getCragImageUrl } from '../utils/firebaseStorage';
import { createSectorViewLink } from '../utils/createSectorViewLink';

interface RoutePageProps {
  sectors: Sector[];
  onSectorChange?: (sectorName: string | undefined) => void;
  onRouteChange?: (routeName: string | undefined) => void;
}

const RoutePage: React.FC<RoutePageProps> = ({ sectors, onSectorChange, onRouteChange }) => {
  const { sectorName, routeName } = useParams<{ sectorName: string; routeName: string }>();
  const { crag, getUrl } = useCrag();

  React.useEffect(() => {
    if (onSectorChange) {
      onSectorChange(sectorName);
    }
    if (onRouteChange) {
      onRouteChange(routeName);
    }
  }, [sectorName, routeName, onSectorChange, onRouteChange]);

  const sector = sectors.find(s => s.name.toLowerCase() === (sectorName || '').toLowerCase());

  if (!sector) return <div className="page">Sector not found.</div>;

  const route = sector.routes.find(r => r.name.toLowerCase() === (routeName || '').toLowerCase());

  if (!route) return <div className="page">Route not found.</div>;

  return (
    <div className="page">
      <SectorView
        cragId={crag.cragId}
        sector={sector}
        route={route}
        getImageUrl={getCragImageUrl}
        createLink={createSectorViewLink(getUrl, crag.cragId, sector.geo)}
      />
    </div>
  );
};

export default RoutePage; 