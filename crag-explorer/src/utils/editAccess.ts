import type { Route, Sector } from '../types';

const EDIT_MISSING_ID_MESSAGE = 'This sector cannot be edited because it has no id.';
const EDIT_MISSING_VERSION_MESSAGE = 'This sector cannot be edited because it has no version.';
const PERMISSION_MESSAGE = 'You do not have permission to edit this crag.';

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

export {
  EDIT_MISSING_ID_MESSAGE,
  EDIT_MISSING_VERSION_MESSAGE,
  PERMISSION_MESSAGE,
  hasEditIdentity,
  otherRouteNames,
  otherSectorNames,
};

export type { EditableSector };
