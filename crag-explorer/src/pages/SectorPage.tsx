import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useDeleteSector, usePatchSector } from '../api/useCragMutations';
import { canEditCrag } from '../api/permissions';
import EditSectorModal from '../components/EditSectorModal';
import RouteDetailsModal from '../components/RouteDetailsModal';
import RouteListModal from '../components/RouteListModal';
import SectorOptionsMenu from '../components/SectorOptionsMenu';
import SectorView from '../components/SectorView';
import { useCrag } from '../context/CragContext';
import { Route, Sector } from '../types';
import type { SectorDetailsPatch } from '../utils/sectorDetails';
import { getCragImageUrl } from '../utils/firebaseStorage';
import { setMapCenter } from '../utils/map';

const DELETE_MISSING_ID_MESSAGE = 'This sector cannot be deleted because it has no id.';
const EDIT_MISSING_ID_MESSAGE = 'This sector cannot be edited because it has no id.';
const EDIT_MISSING_VERSION_MESSAGE = 'This sector cannot be edited because it has no version.';
const PERMISSION_MESSAGE = 'You do not have permission to edit this crag.';

interface SectorPageProps {
  sectors: Sector[];
  onSectorChange?: (sectorName: string | undefined) => void;
}

type RouteEditorState =
  | { mode: 'add' }
  | { mode: 'edit'; index: number; route: Route };

function otherRouteNames(routes: readonly Route[], index: number | null): string[] {
  return routes
    .filter((_, routeIndex) => routeIndex !== index)
    .map((route) => route.name);
}

function otherSectorNames(sectors: readonly Sector[], sector: Sector): string[] {
  return sectors
    .filter((item) => item !== sector && !(sector.id != null && item.id === sector.id))
    .map((item) => item.name);
}

const SectorPage: React.FC<SectorPageProps> = ({ sectors, onSectorChange }) => {
  const { sectorName } = useParams<{ sectorName: string }>();
  const { crag, getUrl } = useCrag();
  const navigate = useNavigate();
  const deleteSectorMutation = useDeleteSector(crag.cragId);
  const patchSectorMutation = usePatchSector(crag.cragId);
  const [headerError, setHeaderError] = useState<string | null>(null);
  const [editingSector, setEditingSector] = useState<Sector | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [routesOpen, setRoutesOpen] = useState(false);
  const [routesSectorId, setRoutesSectorId] = useState<string | null>(null);
  const [routesVersion, setRoutesVersion] = useState<number | null>(null);
  const [routeEditor, setRouteEditor] = useState<RouteEditorState | null>(null);
  const [routeListError, setRouteListError] = useState<string | null>(null);
  const [routeEditError, setRouteEditError] = useState<string | null>(null);
  const sector = sectors.find(s => s.name.toLowerCase() === (sectorName || '').toLowerCase());
  const editing = editingSector !== null && sector?.id === editingSector.id;
  const canEdit = canEditCrag(crag);

  useEffect(() => {
    if (onSectorChange) {
      onSectorChange(sectorName);
    }
  }, [sectorName, onSectorChange]);

  useEffect(() => {
    if (editingSector !== null && sector?.id !== editingSector.id) {
      setEditingSector(null);
      setEditError(null);
    }
  }, [editingSector, sector?.id]);

  useEffect(() => {
    if (!routesOpen && routeEditor === null) return;
    if (sector?.id != null && sector.id === routesSectorId) return;
    setRoutesOpen(false);
    setRoutesSectorId(null);
    setRoutesVersion(null);
    setRouteEditor(null);
    setRouteListError(null);
    setRouteEditError(null);
  }, [routesOpen, routeEditor, routesSectorId, sector?.id]);

  const handleDelete = async () => {
    if (!sector || deleteSectorMutation.isPending) return;
    if (!canEditCrag(crag)) {
      setHeaderError(PERMISSION_MESSAGE);
      return;
    }
    if (!sector.id) {
      setHeaderError(DELETE_MISSING_ID_MESSAGE);
      return;
    }
    const confirmed = window.confirm(
      `Delete the "${sector.name}" sector? This permanently removes the sector and all of its routes.`,
    );
    if (!confirmed) return;

    setHeaderError(null);
    try {
      await deleteSectorMutation.mutateAsync(sector.id);
      navigate(getUrl('/routes'));
    } catch (error) {
      console.error('Failed to delete sector:', error);
      setHeaderError(error instanceof Error ? error.message : 'Failed to delete sector');
    }
  };

  const openEdit = () => {
    if (!sector) return;
    if (!canEditCrag(crag)) {
      setHeaderError(PERMISSION_MESSAGE);
      return;
    }
    if (!sector.id) {
      setHeaderError(EDIT_MISSING_ID_MESSAGE);
      return;
    }
    if (typeof sector.version !== 'number') {
      setHeaderError(EDIT_MISSING_VERSION_MESSAGE);
      return;
    }
    setHeaderError(null);
    setEditError(null);
    setEditingSector(sector);
  };

  const captureRouteBaseline = (): boolean => {
    if (!sector) return false;
    if (!canEditCrag(crag)) {
      setHeaderError(PERMISSION_MESSAGE);
      return false;
    }
    if (!sector.id) {
      setHeaderError(EDIT_MISSING_ID_MESSAGE);
      return false;
    }
    if (typeof sector.version !== 'number') {
      setHeaderError(EDIT_MISSING_VERSION_MESSAGE);
      return false;
    }
    setHeaderError(null);
    setRoutesSectorId(sector.id);
    setRoutesVersion(sector.version);
    return true;
  };

  const openRoutes = () => {
    if (!captureRouteBaseline()) return;
    setRouteListError(null);
    setRouteEditError(null);
    setRouteEditor(null);
    setRoutesOpen(true);
  };

  const openRouteDetails = (index: number) => {
    const route = sector?.routes[index];
    if (!route || !captureRouteBaseline()) return;
    setRouteEditError(null);
    setRouteEditor({ mode: 'edit', index, route });
  };

  const closeRoutes = () => {
    if (patchSectorMutation.isPending) return;
    setRoutesOpen(false);
    setRoutesSectorId(null);
    setRoutesVersion(null);
    setRouteEditor(null);
    setRouteListError(null);
    setRouteEditError(null);
  };

  const saveRoutes = async (routes: Route[], target: 'list' | 'details') => {
    if (!sector?.id || routesVersion === null || patchSectorMutation.isPending) return;
    if (!canEditCrag(crag)) {
      const message = PERMISSION_MESSAGE;
      if (target === 'list') setRouteListError(message);
      else setRouteEditError(message);
      return;
    }
    if (target === 'list') setRouteListError(null);
    else setRouteEditError(null);
    try {
      const saved = await patchSectorMutation.mutateAsync({
        sectorId: sector.id,
        version: routesVersion,
        patch: { routes },
      });
      setRoutesVersion(saved.version);
      if (target === 'details') setRouteEditor(null);
    } catch (error) {
      console.error('Failed to save routes:', error);
      const message = error instanceof Error ? error.message : 'Failed to save routes';
      if (target === 'list') setRouteListError(message);
      else setRouteEditError(message);
    }
  };

  const handleDeleteRoute = async (index: number) => {
    if (!sector || patchSectorMutation.isPending) return;
    const route = sector.routes[index];
    if (!route) return;
    const confirmed = window.confirm(`Delete the "${route.name}" route?`);
    if (!confirmed) return;
    const routes = sector.routes.filter((_, routeIndex) => routeIndex !== index);
    await saveRoutes(routes, 'list');
  };

  const handleSaveRoute = async (route: Route) => {
    if (!sector) return;
    const routes = routeEditor?.mode === 'edit'
      ? sector.routes.map((item, index) => (index === routeEditor.index ? route : item))
      : [...sector.routes, route];
    await saveRoutes(routes, 'details');
  };

  const handleSave = async (patch: SectorDetailsPatch) => {
    if (!editingSector?.id || typeof editingSector.version !== 'number' || patchSectorMutation.isPending) return;
    if (!canEditCrag(crag)) {
      setEditError(PERMISSION_MESSAGE);
      return;
    }
    setEditError(null);
    try {
      const saved = await patchSectorMutation.mutateAsync({
        sectorId: editingSector.id,
        version: editingSector.version,
        patch,
      });
      setEditingSector(null);
      if (saved.name.toLowerCase() !== (sectorName || '').toLowerCase()) {
        navigate(
          getUrl(`/sector/${encodeURIComponent(saved.name.toLowerCase())}`),
          { replace: true },
        );
      }
    } catch (error) {
      console.error('Failed to save sector:', error);
      setEditError(error instanceof Error ? error.message : 'Failed to save sector');
    }
  };

  if (!sector) return <div className="page">Sector not found.</div>;

  return (
    <div className="page">
      <SectorView
        cragId={crag.cragId}
        sector={sector}
        getImageUrl={getCragImageUrl}
        headerActions={
          canEdit ? (
            <SectorOptionsMenu
              disabled={deleteSectorMutation.isPending || patchSectorMutation.isPending}
              onEdit={openEdit}
              onRoutes={openRoutes}
              onDelete={() => void handleDelete()}
            />
          ) : undefined
        }
        headerAlert={headerError}
        onEditRoute={canEdit ? openRouteDetails : undefined}
        routeMenuDisabled={deleteSectorMutation.isPending || patchSectorMutation.isPending}
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
      <EditSectorModal
        key={editing ? 'editing' : 'idle'}
        open={editing}
        sector={editingSector ?? sector}
        takenNames={otherSectorNames(sectors, editingSector ?? sector)}
        mapUrl={getUrl('/map')}
        saving={patchSectorMutation.isPending}
        error={editError}
        onClose={() => {
          if (patchSectorMutation.isPending) return;
          setEditingSector(null);
          setEditError(null);
        }}
        onLocationClick={() => {
          if (sector.geo) setMapCenter(crag.cragId, [sector.geo.lat, sector.geo.lon], 17);
        }}
        onSave={(patch) => void handleSave(patch)}
      />
      <RouteListModal
        open={routesOpen && routeEditor === null}
        routes={sector.routes}
        saving={patchSectorMutation.isPending}
        error={routeListError}
        onClose={closeRoutes}
        onAdd={() => {
          setRouteEditError(null);
          setRouteEditor({ mode: 'add' });
        }}
        onEdit={(index) => {
          const route = sector.routes[index];
          if (!route) return;
          setRouteEditError(null);
          setRouteEditor({ mode: 'edit', index, route });
        }}
        onDelete={(index) => void handleDeleteRoute(index)}
      />
      <RouteDetailsModal
        key={
          routeEditor === null
            ? 'route-idle'
            : routeEditor.mode === 'add'
              ? 'route-add'
              : `route-${routeEditor.index}-${routeEditor.route.id ?? routeEditor.route.name}`
        }
        open={routeEditor !== null}
        route={routeEditor?.mode === 'edit' ? routeEditor.route : null}
        sectorName={sector.name}
        takenNames={otherRouteNames(
          sector.routes,
          routeEditor?.mode === 'edit' ? routeEditor.index : null,
        )}
        saving={patchSectorMutation.isPending}
        error={routeEditError}
        onClose={() => {
          if (patchSectorMutation.isPending) return;
          setRouteEditor(null);
          setRouteEditError(null);
        }}
        onSave={(route) => void handleSaveRoute(route)}
      />
    </div>
  );
};

export default SectorPage;
