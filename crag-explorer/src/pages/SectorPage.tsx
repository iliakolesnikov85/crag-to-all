import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useDeleteSector, usePatchSector } from '../api/useCragMutations';
import { canEditCrag } from '../api/permissions';
import DrawRouteModal from '../components/DrawRouteModal';
import SectorDetailsModal from '../components/SectorDetailsModal';
import RouteDetailsModal from '../components/RouteDetailsModal';
import RouteListModal from '../components/RouteListModal';
import SectorOptionsMenu from '../components/SectorOptionsMenu';
import SectorView from '../components/SectorView';
import { useCrag } from '../context/CragContext';
import { Image, Route, Sector, type LinePoint } from '../types';
import type { SectorDetailsPatch } from '../utils/sectorDetails';
import { moveRouteOnImage, removeRouteFromImage, setRouteLineOnImage } from '../utils/routeOrder';
import { moveTopoImage, removeTopoImage } from '../utils/topoImages';
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

type RouteDrawState = {
  index: number;
  route: Route;
  imageFile: string;
};

type EditableSector = Sector & { id: string; version: number };

function hasEditIdentity(sector: Sector): sector is EditableSector {
  return Boolean(sector.id) && typeof sector.version === 'number';
}

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

function indexOfDrawnRoute(routes: readonly Route[], draw: RouteDrawState): number {
  const current = routes[draw.index];
  if (current?.id === draw.route.id) return draw.index;
  return routes.findIndex((route) => route.id === draw.route.id);
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
  const [drawImageFile, setDrawImageFile] = useState<string | null>(null);
  const [routesSectorId, setRoutesSectorId] = useState<string | null>(null);
  const [routesVersion, setRoutesVersion] = useState<number | null>(null);
  const [routeEditor, setRouteEditor] = useState<RouteEditorState | null>(null);
  const [routeDraw, setRouteDraw] = useState<RouteDrawState | null>(null);
  const [routeListError, setRouteListError] = useState<string | null>(null);
  const [routeEditError, setRouteEditError] = useState<string | null>(null);
  const [routeDrawError, setRouteDrawError] = useState<string | null>(null);
  const requestedName = (sectorName || '').toLowerCase();
  const sector = sectors.find((item) => item.name.toLowerCase() === requestedName);
  const editing = editingSector !== null && sector?.id === editingSector.id;
  const canEdit = canEditCrag(crag);
  const saving = patchSectorMutation.isPending;
  const menusDisabled = deleteSectorMutation.isPending || saving;

  const clearRouteSession = useCallback(() => {
    setRoutesOpen(false);
    setDrawImageFile(null);
    setRoutesSectorId(null);
    setRoutesVersion(null);
    setRouteEditor(null);
    setRouteDraw(null);
    setRouteListError(null);
    setRouteEditError(null);
    setRouteDrawError(null);
  }, []);

  const requireEditable = (): EditableSector | null => {
    if (!sector) return null;
    if (!canEdit) {
      setHeaderError(PERMISSION_MESSAGE);
      return null;
    }
    if (!hasEditIdentity(sector)) {
      setHeaderError(sector.id ? EDIT_MISSING_VERSION_MESSAGE : EDIT_MISSING_ID_MESSAGE);
      return null;
    }
    return sector;
  };

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
    if (!routesOpen && routeEditor === null && routeDraw === null) return;
    if (sector?.id != null && sector.id === routesSectorId) return;
    clearRouteSession();
  }, [clearRouteSession, routesOpen, routeEditor, routeDraw, routesSectorId, sector?.id]);

  const handleDelete = async () => {
    if (!sector || deleteSectorMutation.isPending) return;
    if (!canEdit) {
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
    const target = requireEditable();
    if (!target) return;
    setHeaderError(null);
    setEditError(null);
    setEditingSector(target);
  };

  const captureRouteBaseline = (): boolean => {
    const target = requireEditable();
    if (!target) return false;
    setHeaderError(null);
    setRoutesSectorId(target.id);
    setRoutesVersion(target.version);
    return true;
  };

  const openRoutes = () => {
    if (!captureRouteBaseline()) return;
    setDrawImageFile(null);
    setRouteListError(null);
    setRouteEditError(null);
    setRouteEditor(null);
    setRoutesOpen(true);
  };

  const openDrawLines = (imageIndex: number) => {
    const imageFile = sector?.images[imageIndex]?.imageFile;
    if (!imageFile || !captureRouteBaseline()) return;
    setDrawImageFile(imageFile);
    setRouteListError(null);
    setRouteEditError(null);
    setRouteDrawError(null);
    setRouteEditor(null);
    setRouteDraw(null);
    setRoutesOpen(true);
  };

  const openRouteEditor = (editor: RouteEditorState) => {
    setRouteEditError(null);
    setRouteEditor(editor);
  };

  const openRouteDetails = (index: number) => {
    const route = sector?.routes[index];
    if (!route || !captureRouteBaseline()) return;
    openRouteEditor({ mode: 'edit', index, route });
  };

  const openRedraw = (imageFile: string, index: number) => {
    const route = sector?.routes[index];
    if (!route || !captureRouteBaseline()) return;
    setRouteDrawError(null);
    setRouteDraw({ index, route, imageFile });
  };

  const closeRoutes = () => {
    if (saving) return;
    clearRouteSession();
  };

  const saveRoutes = async (
    routes: Route[],
    target: 'list' | 'details' | 'line',
  ): Promise<Sector | null> => {
    if (!sector?.id || routesVersion === null || saving) return null;
    const setRouteError = target === 'list'
      ? setRouteListError
      : target === 'details'
        ? setRouteEditError
        : setRouteDrawError;
    if (!canEdit) {
      setRouteError(PERMISSION_MESSAGE);
      return null;
    }
    setRouteError(null);
    try {
      const saved = await patchSectorMutation.mutateAsync({
        sectorId: sector.id,
        version: routesVersion,
        patch: { routes },
      });
      setRoutesVersion(saved.version);
      if (target === 'details') setRouteEditor(null);
      if (target === 'line') setRouteDraw(null);
      return saved;
    } catch (error) {
      console.error('Failed to save routes:', error);
      const message = error instanceof Error ? error.message : 'Failed to save routes';
      setRouteError(message);
      return null;
    }
  };

  const handleDeleteRoute = async (index: number) => {
    if (!sector || saving) return;
    const route = sector.routes[index];
    if (!route) return;
    const confirmed = window.confirm(`Delete the "${route.name}" route?`);
    if (!confirmed) return;
    const routes = sector.routes.filter((_, routeIndex) => routeIndex !== index);
    await saveRoutes(routes, 'list');
  };

  const handleRemoveFromImage = async (index: number) => {
    if (!sector || !drawImageFile || saving) return;
    const route = sector.routes[index];
    if (!route) return;
    const confirmed = window.confirm(
      `Remove the "${route.name}" route from this topo image?`,
    );
    if (!confirmed) return;
    const routes = removeRouteFromImage(sector.routes, index, drawImageFile);
    if (!routes) return;
    await saveRoutes(routes, 'list');
  };

  const handleSaveRoute = async (route: Route) => {
    if (!sector || !routeEditor) return;
    const adding = routeEditor.mode === 'add';
    const routes = adding
      ? [...sector.routes, route]
      : sector.routes.map((item, index) => (index === routeEditor.index ? route : item));
    const saved = await saveRoutes(routes, 'details');
    if (!saved || !adding || !drawImageFile) return;
    const index = saved.routes.findIndex((item) => item.id === route.id);
    const savedRoute = index >= 0 ? saved.routes[index] : undefined;
    if (!savedRoute) return;
    setRouteDrawError(null);
    setRouteDraw({ index, route: savedRoute, imageFile: drawImageFile });
  };

  const openDrawFromList = (index: number) => {
    if (!drawImageFile) return;
    const route = sector?.routes[index];
    if (!route) return;
    setRouteDrawError(null);
    setRouteDraw({ index, route, imageFile: drawImageFile });
  };

  const handleSaveRouteLine = async (line: LinePoint[]) => {
    if (!sector || !routeDraw) return;
    const located = indexOfDrawnRoute(sector.routes, routeDraw);
    const routes = located >= 0 ? sector.routes : [...sector.routes, routeDraw.route];
    const index = located >= 0 ? located : routes.length - 1;
    const next = setRouteLineOnImage(routes, index, routeDraw.imageFile, line);
    if (!next) return;
    await saveRoutes(next, 'line');
  };

  const requireTopoEditable = (): EditableSector | null => {
    if (saving) return null;
    return requireEditable();
  };

  const rememberSavedSector = (targetId: string, saved: Sector) => {
    if (routesSectorId === targetId) setRoutesVersion(saved.version);
    setRouteEditor((current) => {
      if (!current || current.mode !== 'edit') return current;
      const updated = saved.routes[current.index];
      return updated ? { mode: 'edit', index: current.index, route: updated } : current;
    });
  };

  const saveTopoImages = async (target: EditableSector, images: Image[]) => {
    if (saving) return;
    setHeaderError(null);
    try {
      const saved = await patchSectorMutation.mutateAsync({
        sectorId: target.id,
        version: target.version,
        patch: { images },
      });
      rememberSavedSector(target.id, saved);
    } catch (error) {
      console.error('Failed to update topo images:', error);
      setHeaderError(error instanceof Error ? error.message : 'Failed to update topo images');
    }
  };

  const handleDeleteTopo = async (index: number) => {
    const target = requireTopoEditable();
    if (!target?.images[index]) return;
    const confirmed = window.confirm(
      `Delete topo image ${index + 1}/${target.images.length}?`,
    );
    if (!confirmed) return;
    const next = removeTopoImage(target.images, index);
    if (!next) return;
    await saveTopoImages(target, next);
  };

  const handleMoveTopo = async (index: number, direction: -1 | 1) => {
    const target = requireTopoEditable();
    if (!target) return;
    const next = moveTopoImage(target.images, index, direction);
    if (!next) return;
    const place = direction < 0 ? 'up' : 'down';
    const confirmed = window.confirm(
      `Move topo image ${index + 1}/${target.images.length} ${place}?`,
    );
    if (!confirmed) return;
    await saveTopoImages(target, next);
  };

  const handleMoveRoute = async (imageFile: string, index: number, direction: -1 | 1) => {
    const target = requireTopoEditable();
    if (!target) return;
    const next = moveRouteOnImage(target.routes, imageFile, index, direction);
    if (!next) return;
    const count = target.routes.filter((route) =>
      route.images.some((image) => image.imageFile === imageFile),
    ).length;
    const place = direction < 0 ? 'up' : 'down';
    const confirmed = window.confirm(`Move route ${index + 1}/${count} ${place}?`);
    if (!confirmed) return;
    setHeaderError(null);
    try {
      const saved = await patchSectorMutation.mutateAsync({
        sectorId: target.id,
        version: target.version,
        patch: { routes: next },
      });
      rememberSavedSector(target.id, saved);
    } catch (error) {
      console.error('Failed to move route:', error);
      setHeaderError(error instanceof Error ? error.message : 'Failed to move route');
    }
  };

  const handleSave = async (patch: SectorDetailsPatch) => {
    if (!editingSector?.id || typeof editingSector.version !== 'number' || saving) return;
    if (!canEdit) {
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
      if (saved.name.toLowerCase() !== requestedName) {
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

  const focusSectorOnMap = () => {
    if (!sector.geo) return;
    setMapCenter(crag.cragId, [sector.geo.lat, sector.geo.lon], 17);
  };

  return (
    <div className="page">
      <SectorView
        cragId={crag.cragId}
        sector={sector}
        getImageUrl={getCragImageUrl}
        headerActions={
          canEdit ? (
            <SectorOptionsMenu
              disabled={menusDisabled}
              onEdit={openEdit}
              onRoutes={openRoutes}
              onDelete={() => void handleDelete()}
            />
          ) : undefined
        }
        headerAlert={headerError}
        onEditRoute={canEdit ? openRouteDetails : undefined}
        onRedrawRoute={canEdit ? openRedraw : undefined}
        onMoveRoute={canEdit ? (imageFile, index, direction) => void handleMoveRoute(imageFile, index, direction) : undefined}
        routeMenuDisabled={menusDisabled}
        onDrawLines={canEdit ? openDrawLines : undefined}
        onDeleteTopo={canEdit ? (index) => void handleDeleteTopo(index) : undefined}
        onMoveTopo={canEdit ? (index, direction) => void handleMoveTopo(index, direction) : undefined}
        topoMenuDisabled={menusDisabled}
        createLink={(to: string, children: React.ReactNode, title?: string) => (
          <Link
            className="link"
            to={getUrl(to)}
            title={title}
            onClick={() => {
              if (to === '/map') focusSectorOnMap();
            }}
          >
            {children}
          </Link>
        )}
      />
      <SectorDetailsModal
        key={editing ? 'editing' : 'idle'}
        open={editing}
        sector={editingSector ?? sector}
        takenNames={otherSectorNames(sectors, editingSector ?? sector)}
        mapUrl={getUrl('/map')}
        saving={saving}
        error={editError}
        onClose={() => {
          if (saving) return;
          setEditingSector(null);
          setEditError(null);
        }}
        onLocationClick={focusSectorOnMap}
        onSave={(patch) => void handleSave(patch)}
      />
      <RouteListModal
        open={routesOpen && routeEditor === null && routeDraw === null}
        mode={drawImageFile ? 'draw' : 'routes'}
        imageFile={drawImageFile ?? undefined}
        routes={sector.routes}
        saving={saving}
        error={routeListError}
        onClose={closeRoutes}
        onAdd={() => openRouteEditor({ mode: 'add' })}
        onEdit={(index) => {
          const route = sector.routes[index];
          if (!route) return;
          openRouteEditor({ mode: 'edit', index, route });
        }}
        onDelete={(index) => void handleDeleteRoute(index)}
        onDraw={openDrawFromList}
        onRemove={(index) => void handleRemoveFromImage(index)}
      />
      <RouteDetailsModal
        key={
          routeEditor === null
            ? 'route-idle'
            : routeEditor.mode === 'add'
              ? 'route-add'
              : `route-${routeEditor.index}-${routeEditor.route.id}`
        }
        open={routeEditor !== null}
        route={routeEditor?.mode === 'edit' ? routeEditor.route : null}
        sectorName={sector.name}
        takenNames={otherRouteNames(
          sector.routes,
          routeEditor?.mode === 'edit' ? routeEditor.index : null,
        )}
        saving={saving}
        error={routeEditError}
        onClose={() => {
          if (saving) return;
          if (routesOpen) {
            setRouteEditor(null);
            setRouteEditError(null);
            return;
          }
          clearRouteSession();
        }}
        onSave={(route) => void handleSaveRoute(route)}
      />
      {routeDraw ? (
        <DrawRouteModal
          key={`${routeDraw.index}-${routeDraw.imageFile}`}
          open
          route={routeDraw.route}
          imageFile={routeDraw.imageFile}
          imageUrl={getCragImageUrl(crag.cragId, routeDraw.imageFile)}
          saving={saving}
          error={routeDrawError}
          onClose={() => {
            if (saving) return;
            if (routesOpen) {
              setRouteDraw(null);
              setRouteDrawError(null);
              return;
            }
            clearRouteSession();
          }}
          onSave={(line) => void handleSaveRouteLine(line)}
        />
      ) : null}
    </div>
  );
};

export default SectorPage;
