import { useEffect, useRef, useState } from 'react';
import type { SectorPatch } from '../api/client';
import { usePatchSector } from '../api/useCragMutations';
import { useCanEditCrag } from '../auth/useAuthSession';
import RouteDetailsModal from '../components/RouteDetailsModal';
import SectorDetailsModal from '../components/SectorDetailsModal';
import { confirm } from '../context/ConfirmContext';
import { useCrag } from '../context/CragContext';
import type { Route, Sector } from '../types';
import {
  EDIT_MISSING_ID_MESSAGE,
  EDIT_MISSING_VERSION_MESSAGE,
  PERMISSION_MESSAGE,
  hasEditIdentity,
  otherRouteNames,
  otherSectorNames,
  type EditableSector,
} from '../utils/editAccess';
import type { SectorDetailsPatch } from '../utils/sectorDetails';
import { setMapCenter } from '../utils/map';

const MISSING_SECTOR_MESSAGE = 'This sector could not be found. Reload the page and try again.';

interface UseDetailsEditorsOptions {
  sectors: readonly Sector[];
  /**
   * Close editors for a different sector. `null` means this page has no current
   * sector. Leave unset on pages that are not tied to one sector.
   */
  boundSectorId?: string | null;
  onNotice?: (message: string | null) => void;
  onSectorSaved?: (sector: Sector) => void;
  onRouteSaved?: (saved: Sector, route: Route, mode: 'add' | 'edit') => void;
}

type RouteEditState =
  | { mode: 'add'; sectorId: string; version: number }
  | { mode: 'edit'; sectorId: string; version: number; index: number; route: Route };

interface SectorPatchInput {
  sectorId: string;
  version: number;
  patch: SectorPatch;
}

interface DeleteRouteInput {
  sector: Sector;
  index: number;
  /** Patch this version instead of `sector.version`. */
  version?: number;
  /** Report a refusal or a failed save here. Defaults to the page notice. */
  onError?: (message: string | null) => void;
}

function replaceRoute(
  routes: readonly Route[],
  edit: Extract<RouteEditState, { mode: 'edit' }>,
  route: Route,
): Route[] | null {
  const index = routes[edit.index]?.id === edit.route.id
    ? edit.index
    : routes.findIndex((item) => item.id === edit.route.id);
  if (index < 0) return null;
  return routes.map((item, itemIndex) => (itemIndex === index ? route : item));
}

function useDetailsEditors({
  sectors,
  boundSectorId,
  onNotice,
  onSectorSaved,
  onRouteSaved,
}: UseDetailsEditorsOptions) {
  const { crag, getUrl } = useCrag();
  const patchSector = usePatchSector(crag.cragId);
  const [sectorEdit, setSectorEdit] = useState<EditableSector | null>(null);
  const [sectorError, setSectorError] = useState<string | null>(null);
  const [routeEdit, setRouteEdit] = useState<RouteEditState | null>(null);
  const [routeError, setRouteError] = useState<string | null>(null);
  const onNoticeRef = useRef(onNotice);
  const onSectorSavedRef = useRef(onSectorSaved);
  const onRouteSavedRef = useRef(onRouteSaved);
  onNoticeRef.current = onNotice;
  onSectorSavedRef.current = onSectorSaved;
  onRouteSavedRef.current = onRouteSaved;
  const saving = patchSector.isPending;
  const canEdit = useCanEditCrag(crag);

  const report = (message: string | null) => {
    onNoticeRef.current?.(message);
  };

  const requireEditable = (sector: Sector): EditableSector | null => {
    if (!canEdit) {
      report(PERMISSION_MESSAGE);
      return null;
    }
    if (!hasEditIdentity(sector)) {
      report(sector.id ? EDIT_MISSING_VERSION_MESSAGE : EDIT_MISSING_ID_MESSAGE);
      return null;
    }
    report(null);
    return sector;
  };

  useEffect(() => {
    if (boundSectorId === undefined) return;
    if (sectorEdit && sectorEdit.id !== boundSectorId) {
      setSectorEdit(null);
      setSectorError(null);
    }
    if (routeEdit && routeEdit.sectorId !== boundSectorId) {
      setRouteEdit(null);
      setRouteError(null);
    }
  }, [boundSectorId, routeEdit, sectorEdit]);

  const savePatch = (input: SectorPatchInput): Promise<Sector> => patchSector.mutateAsync(input);

  const openSector = (sector: Sector) => {
    const target = requireEditable(sector);
    if (!target) return;
    setSectorError(null);
    setSectorEdit(target);
  };

  const openRoute = (sector: Sector, index: number, version?: number) => {
    const target = requireEditable(sector);
    if (!target) return;
    const route = target.routes[index];
    if (!route) return;
    setRouteError(null);
    setRouteEdit({
      mode: 'edit',
      sectorId: target.id,
      version: version ?? target.version,
      index,
      route,
    });
  };

  const openNewRoute = (sector: Sector, version?: number) => {
    const target = requireEditable(sector);
    if (!target) return;
    setRouteError(null);
    setRouteEdit({
      mode: 'add',
      sectorId: target.id,
      version: version ?? target.version,
    });
  };

  const noteSaved = (saved: Sector) => {
    if (saved.id == null || typeof saved.version !== 'number') return;
    setRouteEdit((current) => {
      if (!current || current.sectorId !== saved.id) return current;
      if (current.mode === 'add') return { ...current, version: saved.version };
      const atIndex = saved.routes[current.index];
      if (atIndex?.id === current.route.id) {
        return { ...current, version: saved.version, route: atIndex };
      }
      const found = saved.routes.findIndex((route) => route.id === current.route.id);
      if (found < 0) return { ...current, version: saved.version };
      return {
        ...current,
        version: saved.version,
        index: found,
        route: saved.routes[found],
      };
    });
  };

  const focusSectorOnMap = (sector: Sector) => {
    if (!sector.geo) return;
    setMapCenter(crag.cragId, [sector.geo.lat, sector.geo.lon], 17);
  };

  const saveSector = async (patch: SectorDetailsPatch) => {
    if (!sectorEdit || saving) return;
    if (!canEdit) {
      setSectorError(PERMISSION_MESSAGE);
      return;
    }
    setSectorError(null);
    try {
      const saved = await savePatch({
        sectorId: sectorEdit.id,
        version: sectorEdit.version,
        patch,
      });
      setSectorEdit(null);
      onSectorSavedRef.current?.(saved);
    } catch (error) {
      console.error('Failed to save sector:', error);
      setSectorError(error instanceof Error ? error.message : 'Failed to save sector');
    }
  };

  const deleteRoute = async ({ sector, index, version, onError }: DeleteRouteInput): Promise<Sector | null> => {
    if (saving) return null;
    const notify = onError ?? report;
    if (!canEdit) {
      notify(PERMISSION_MESSAGE);
      return null;
    }
    if (!hasEditIdentity(sector)) {
      notify(sector.id ? EDIT_MISSING_VERSION_MESSAGE : EDIT_MISSING_ID_MESSAGE);
      return null;
    }
    const route = sector.routes[index];
    if (!route) return null;
    const confirmed = await confirm({
      title: 'Delete route',
      message: `Delete the "${route.name}" route?`,
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!confirmed) return null;
    notify(null);
    try {
      return await savePatch({
        sectorId: sector.id,
        version: version ?? sector.version,
        patch: { routes: sector.routes.filter((_, routeIndex) => routeIndex !== index) },
      });
    } catch (error) {
      console.error('Failed to delete route:', error);
      notify(error instanceof Error ? error.message : 'Failed to delete route');
      return null;
    }
  };

  const saveRoute = async (route: Route) => {
    if (!routeEdit || saving) return;
    if (!canEdit) {
      setRouteError(PERMISSION_MESSAGE);
      return;
    }
    const mode = routeEdit.mode;
    setRouteError(null);
    try {
      const current = sectors.find((item) => item.id === routeEdit.sectorId);
      if (!current) throw new Error(MISSING_SECTOR_MESSAGE);
      const routes = mode === 'add'
        ? [...current.routes, route]
        : replaceRoute(current.routes, routeEdit, route);
      if (!routes) return;
      const saved = await savePatch({
        sectorId: routeEdit.sectorId,
        version: routeEdit.version,
        patch: { routes },
      });
      setRouteEdit(null);
      onRouteSavedRef.current?.(saved, route, mode);
    } catch (error) {
      console.error('Failed to save routes:', error);
      setRouteError(error instanceof Error ? error.message : 'Failed to save routes');
    }
  };

  const routeSector = sectors.find((item) => item.id === routeEdit?.sectorId);

  const dialogs = (
    <>
      {sectorEdit ? (
        <SectorDetailsModal
          open
          sector={sectorEdit}
          takenNames={otherSectorNames(sectors, sectorEdit)}
          mapUrl={getUrl('/map')}
          saving={saving}
          error={sectorError}
          onClose={() => {
            if (saving) return;
            setSectorEdit(null);
            setSectorError(null);
          }}
          onLocationClick={() => focusSectorOnMap(sectorEdit)}
          onSave={(patch) => void saveSector(patch)}
        />
      ) : null}
      <RouteDetailsModal
        key={routeEdit === null
          ? 'route-idle'
          : routeEdit.mode === 'add'
            ? 'route-add'
            : `route-${routeEdit.index}-${routeEdit.route.id}`}
        open={routeEdit !== null}
        route={routeEdit?.mode === 'edit' ? routeEdit.route : null}
        sectorName={routeSector?.name ?? (routeEdit?.mode === 'edit' ? routeEdit.route.sectorName : '')}
        takenNames={otherRouteNames(
          routeSector?.routes ?? [],
          routeEdit?.mode === 'edit' ? routeEdit.index : null,
        )}
        saving={saving}
        error={routeError}
        onClose={() => {
          if (saving) return;
          setRouteEdit(null);
          setRouteError(null);
        }}
        onSave={(route) => void saveRoute(route)}
      />
    </>
  );

  return {
    requireEditable,
    openSector,
    openRoute,
    openNewRoute,
    noteSaved,
    deleteRoute,
    savePatch,
    saving,
    editingRoute: routeEdit !== null,
    dialogs,
  };
}

export default useDetailsEditors;
