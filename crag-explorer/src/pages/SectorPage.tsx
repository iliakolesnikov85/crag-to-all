import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { uploadCragImage } from '../api/client';
import { useDeleteSector } from '../api/useCragMutations';
import { useCanEditCrag } from '../auth/useAuthSession';
import AddTopoModal from '../components/AddTopoModal';
import DrawRouteModal from '../components/DrawRouteModal';
import RouteListModal from '../components/RouteListModal';
import SectorOptionsMenu from '../components/SectorOptionsMenu';
import SectorView from '../components/SectorView';
import { confirm } from '../context/ConfirmContext';
import { useCrag } from '../context/CragContext';
import { Image, Route, Sector, type LatLng, type LinePoint } from '../types';
import { PERMISSION_MESSAGE, type EditableSector } from '../utils/editAccess';
import { moveRouteOnImage, removeRouteFromImage, setRouteLineOnImage } from '../utils/routeOrder';
import { moveTopoImage, removeTopoImage } from '../utils/topoImages';
import { getCragImageUrl } from '../utils/firebaseStorage';
import { setMapCenter } from '../utils/map';
import useDetailsEditors from './useDetailsEditors';

const DELETE_MISSING_ID_MESSAGE = 'This sector cannot be deleted because it has no id.';

interface SectorPageProps {
  sectors: Sector[];
  onSectorChange?: (sectorName: string | undefined) => void;
}

type RouteDrawState = {
  index: number;
  route: Route;
  imageFile: string;
};

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
  const [headerError, setHeaderError] = useState<string | null>(null);
  const [routesOpen, setRoutesOpen] = useState(false);
  const [drawImageFile, setDrawImageFile] = useState<string | null>(null);
  const [routesSectorId, setRoutesSectorId] = useState<string | null>(null);
  const [routesVersion, setRoutesVersion] = useState<number | null>(null);
  const [routeDraw, setRouteDraw] = useState<RouteDrawState | null>(null);
  const [routeListError, setRouteListError] = useState<string | null>(null);
  const [routeDrawError, setRouteDrawError] = useState<string | null>(null);
  const [addingTopo, setAddingTopo] = useState(false);
  const [addTopoSectorId, setAddTopoSectorId] = useState<string | null>(null);
  const [addTopoError, setAddTopoError] = useState<string | null>(null);
  const [topoSaving, setTopoSaving] = useState(false);
  const topoSavingRef = useRef(false);
  const requestedName = (sectorName || '').toLowerCase();
  const sector = sectors.find((item) => item.name.toLowerCase() === requestedName);
  const editors = useDetailsEditors({
    sectors,
    boundSectorId: sector?.id ?? null,
    onNotice: setHeaderError,
    onSectorSaved: (saved) => {
      if (saved.name.toLowerCase() !== requestedName) {
        navigate(
          getUrl(`/sector/${encodeURIComponent(saved.name.toLowerCase())}`),
          { replace: true },
        );
      }
    },
    onRouteSaved: (saved, route, mode) => {
      if (routesSectorId === saved.id) setRoutesVersion(saved.version);
      if (mode !== 'add' || !drawImageFile) return;
      const index = saved.routes.findIndex((item) => item.id === route.id);
      const savedRoute = index >= 0 ? saved.routes[index] : undefined;
      if (!savedRoute) return;
      setRouteDrawError(null);
      setRouteDraw({ index, route: savedRoute, imageFile: drawImageFile });
    },
  });
  const canEdit = useCanEditCrag(crag);
  const saving = editors.saving;
  const menusDisabled = deleteSectorMutation.isPending || saving || topoSaving;

  const clearRouteSession = useCallback(() => {
    setRoutesOpen(false);
    setDrawImageFile(null);
    setRoutesSectorId(null);
    setRoutesVersion(null);
    setRouteDraw(null);
    setRouteListError(null);
    setRouteDrawError(null);
  }, []);

  const requireEditable = (): EditableSector | null => {
    if (!sector) return null;
    return editors.requireEditable(sector);
  };

  useEffect(() => {
    if (onSectorChange) {
      onSectorChange(sectorName);
    }
  }, [sectorName, onSectorChange]);

  useEffect(() => {
    if (!routesOpen && routeDraw === null) return;
    if (sector?.id != null && sector.id === routesSectorId) return;
    clearRouteSession();
  }, [clearRouteSession, routesOpen, routeDraw, routesSectorId, sector?.id]);

  useEffect(() => {
    if (!addingTopo) return;
    if (sector?.id != null && sector.id === addTopoSectorId) return;
    setAddingTopo(false);
    setAddTopoSectorId(null);
    setAddTopoError(null);
  }, [addingTopo, addTopoSectorId, sector?.id]);

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
    const confirmed = await confirm({
      title: 'Delete sector',
      message: `Delete the "${sector.name}" sector? This permanently removes the sector and all of its routes.`,
      confirmLabel: 'Delete',
      destructive: true,
    });
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
    editors.openSector(sector);
  };

  const openAddTopo = () => {
    const target = requireEditable();
    if (!target) return;
    setHeaderError(null);
    setAddTopoError(null);
    setAddTopoSectorId(target.id);
    setAddingTopo(true);
  };

  const captureRouteBaseline = (): boolean => {
    const target = requireEditable();
    if (!target) return false;
    setRoutesSectorId(target.id);
    setRoutesVersion(target.version);
    return true;
  };

  const openRoutes = () => {
    if (!captureRouteBaseline()) return;
    setDrawImageFile(null);
    setRouteListError(null);
    setRoutesOpen(true);
  };

  const openDrawLines = (imageIndex: number) => {
    const imageFile = sector?.images[imageIndex]?.imageFile;
    if (!imageFile || !captureRouteBaseline()) return;
    setDrawImageFile(imageFile);
    setRouteListError(null);
    setRouteDrawError(null);
    setRouteDraw(null);
    setRoutesOpen(true);
  };

  const openRouteDetails = (index: number) => {
    if (!sector) return;
    editors.openRoute(sector, index);
  };

  const openListedRoute = (index: number) => {
    if (!sector || routesVersion === null) return;
    editors.openRoute(sector, index, routesVersion);
  };

  const openNewRoute = () => {
    if (!sector || routesVersion === null) return;
    editors.openNewRoute(sector, routesVersion);
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
    target: 'list' | 'line',
  ): Promise<Sector | null> => {
    if (!sector?.id || routesVersion === null || saving) return null;
    const setRouteError = target === 'list' ? setRouteListError : setRouteDrawError;
    if (!canEdit) {
      setRouteError(PERMISSION_MESSAGE);
      return null;
    }
    setRouteError(null);
    try {
      const saved = await editors.savePatch({
        sectorId: sector.id,
        version: routesVersion,
        patch: { routes },
      });
      setRoutesVersion(saved.version);
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
    if (!sector || routesVersion === null || saving) return;
    const saved = await editors.deleteRoute({
      sector,
      index,
      version: routesVersion,
      onError: setRouteListError,
    });
    if (!saved) return;
    setRoutesVersion(saved.version);
  };

  const handleRemoveFromImage = async (index: number) => {
    if (!sector || !drawImageFile || saving) return;
    const route = sector.routes[index];
    if (!route) return;
    const confirmed = await confirm({
      title: 'Remove route',
      message: `Remove the "${route.name}" route from this topo image?`,
      confirmLabel: 'Remove',
      destructive: true,
    });
    if (!confirmed) return;
    const routes = removeRouteFromImage(sector.routes, index, drawImageFile);
    if (!routes) return;
    await saveRoutes(routes, 'list');
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
    editors.noteSaved(saved);
  };

  const handleAddTopo = async (file: File, geo: LatLng | null) => {
    const target = requireEditable();
    if (!target || topoSavingRef.current || saving) return;
    topoSavingRef.current = true;
    setTopoSaving(true);
    setAddTopoError(null);
    try {
      const uploaded = await uploadCragImage(crag.cragId, file);
      const images = [...target.images, { imageFile: uploaded.imageFile }];
      const moveToPhoto = target.images.length === 0 && geo != null;
      const saved = await editors.savePatch({
        sectorId: target.id,
        version: target.version,
        patch: moveToPhoto ? { images, geo } : { images },
      });
      rememberSavedSector(target.id, saved);
      setAddingTopo(false);
      setAddTopoSectorId(null);
    } catch (error) {
      console.error('Failed to add topo image:', error);
      setAddTopoError(error instanceof Error ? error.message : 'Failed to add topo image');
    } finally {
      topoSavingRef.current = false;
      setTopoSaving(false);
    }
  };

  const saveTopoImages = async (target: EditableSector, images: Image[]) => {
    if (saving) return;
    setHeaderError(null);
    try {
      const saved = await editors.savePatch({
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
    const confirmed = await confirm({
      title: 'Delete topo image',
      message: `Delete topo image ${index + 1}/${target.images.length}?`,
      confirmLabel: 'Delete',
      destructive: true,
    });
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
    const confirmed = await confirm({
      title: 'Move topo image',
      message: `Move topo image ${index + 1}/${target.images.length} ${place}?`,
      confirmLabel: 'Move',
    });
    if (!confirmed) return;
    await saveTopoImages(target, next);
  };

  const handleRemoveRouteFromImage = async (imageFile: string, sourceIndex: number) => {
    const target = requireTopoEditable();
    if (!target) return;
    const route = target.routes[sourceIndex];
    if (!route) return;
    const confirmed = await confirm({
      title: 'Remove route',
      message: `Remove the "${route.name}" route from this topo image?`,
      confirmLabel: 'Remove',
      destructive: true,
    });
    if (!confirmed) return;
    const next = removeRouteFromImage(target.routes, sourceIndex, imageFile);
    if (!next) return;
    setHeaderError(null);
    try {
      const saved = await editors.savePatch({
        sectorId: target.id,
        version: target.version,
        patch: { routes: next },
      });
      rememberSavedSector(target.id, saved);
    } catch (error) {
      console.error('Failed to remove route from topo image:', error);
      setHeaderError(error instanceof Error ? error.message : 'Failed to remove route from topo image');
    }
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
    const confirmed = await confirm({
      title: 'Move route',
      message: `Move route ${index + 1}/${count} ${place}?`,
      confirmLabel: 'Move',
    });
    if (!confirmed) return;
    setHeaderError(null);
    try {
      const saved = await editors.savePatch({
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
              canDelete={sector.images.length === 0}
              onEdit={openEdit}
              onAddTopo={openAddTopo}
              onRoutes={openRoutes}
              onDelete={() => void handleDelete()}
            />
          ) : undefined
        }
        headerAlert={headerError}
        onEditRoute={canEdit ? openRouteDetails : undefined}
        onRedrawRoute={canEdit ? openRedraw : undefined}
        onRemoveRouteFromImage={canEdit ? (imageFile, sourceIndex) => void handleRemoveRouteFromImage(imageFile, sourceIndex) : undefined}
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
      <AddTopoModal
        key={addTopoSectorId ?? 'add-topo'}
        open={addingTopo}
        offerPhotoLocation={sector.images.length === 0}
        currentGeo={sector.geo}
        saving={topoSaving || saving}
        error={addTopoError}
        onClose={() => {
          if (topoSaving || saving) return;
          setAddingTopo(false);
          setAddTopoSectorId(null);
          setAddTopoError(null);
        }}
        onSave={(file, geo) => void handleAddTopo(file, geo)}
      />
      {editors.dialogs}
      <RouteListModal
        open={routesOpen && !editors.editingRoute && routeDraw === null}
        mode={drawImageFile ? 'draw' : 'routes'}
        imageFile={drawImageFile ?? undefined}
        routes={sector.routes}
        saving={saving}
        error={routeListError}
        onClose={closeRoutes}
        onAdd={openNewRoute}
        onEdit={openListedRoute}
        onDelete={(index) => void handleDeleteRoute(index)}
        onDraw={openDrawFromList}
        onRemove={(index) => void handleRemoveFromImage(index)}
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
