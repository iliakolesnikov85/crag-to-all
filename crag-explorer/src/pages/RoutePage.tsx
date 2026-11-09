import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { canEditCrag } from '../api/permissions';
import RoutePageOptionsMenu from '../components/RoutePageOptionsMenu';
import SectorView from '../components/SectorView';
import { useCrag } from '../context/CragContext';
import { Route, Sector } from '../types';
import { getCragImageUrl } from '../utils/firebaseStorage';
import { setMapCenter } from '../utils/map';
import useDetailsEditors from './useDetailsEditors';

interface RoutePageProps {
  sectors: Sector[];
  onSectorChange?: (sectorName: string | undefined) => void;
  onRouteChange?: (routeName: string | undefined) => void;
}

function indexOfRoute(routes: readonly Route[], route: Route): number {
  const byId = routes.findIndex((item) => item.id === route.id);
  if (byId >= 0) return byId;
  return routes.findIndex((item) => item.name.toLowerCase() === route.name.toLowerCase());
}

const RoutePage: React.FC<RoutePageProps> = ({ sectors, onSectorChange, onRouteChange }) => {
  const { sectorName, routeName } = useParams<{ sectorName: string; routeName: string }>();
  const { crag, getUrl } = useCrag();
  const navigate = useNavigate();
  const [headerError, setHeaderError] = useState<string | null>(null);
  const requestedSector = (sectorName || '').toLowerCase();
  const requestedRoute = (routeName || '').toLowerCase();
  const sector = sectors.find((item) => item.name.toLowerCase() === requestedSector);
  const route = sector?.routes.find((item) => item.name.toLowerCase() === requestedRoute);
  const editors = useDetailsEditors({
    sectors,
    boundSectorId: sector?.id ?? null,
    onNotice: setHeaderError,
    onRouteSaved: (saved, savedRoute) => {
      if (savedRoute.name.toLowerCase() === requestedRoute) return;
      navigate(
        getUrl(
          `/sector/${encodeURIComponent(saved.name.toLowerCase())}/${encodeURIComponent(savedRoute.name.toLowerCase())}`,
        ),
        { replace: true },
      );
    },
  });
  const canEdit = canEditCrag(crag);

  useEffect(() => {
    if (onSectorChange) {
      onSectorChange(sectorName);
    }
    if (onRouteChange) {
      onRouteChange(routeName);
    }
  }, [sectorName, routeName, onSectorChange, onRouteChange]);

  const openEdit = () => {
    if (!sector || !route) return;
    const index = indexOfRoute(sector.routes, route);
    if (index < 0) return;
    editors.openRoute(sector, index);
  };

  const handleDelete = async () => {
    if (!sector || !route || editors.saving) return;
    const index = indexOfRoute(sector.routes, route);
    if (index < 0) return;
    const saved = await editors.deleteRoute({ sector, index });
    if (!saved) return;
    navigate(getUrl(`/sector/${encodeURIComponent(sector.name.toLowerCase())}`));
  };

  if (!sector) return <div className="page">Sector not found.</div>;
  if (!route) return <div className="page">Route not found.</div>;

  return (
    <div className="page">
      <SectorView
        cragId={crag.cragId}
        sector={sector}
        route={route}
        getImageUrl={getCragImageUrl}
        headerActions={
          canEdit ? (
            <RoutePageOptionsMenu
              disabled={editors.saving}
              onEdit={openEdit}
              onDelete={() => void handleDelete()}
            />
          ) : undefined
        }
        headerAlert={headerError}
        createLink={(to: string, children: React.ReactNode, title?: string) => (
          <Link
            className="link"
            to={getUrl(to)}
            title={title}
            onClick={() => {
              if (to !== '/map') return;
              if (sector?.geo) setMapCenter(crag.cragId, [sector?.geo.lat, sector?.geo.lon], 17);
            }}
          >
            {children}
          </Link>
        )}
      />
      {editors.dialogs}
    </div>
  );
};

export default RoutePage;
