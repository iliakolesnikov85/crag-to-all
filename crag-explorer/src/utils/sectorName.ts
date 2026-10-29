const SECTOR_NAME_MAX_LENGTH = 200;
const EMPTY_NAME_ERROR = 'Enter a sector name.';
const LONG_NAME_ERROR = `Sector name must be ${SECTOR_NAME_MAX_LENGTH} characters or fewer.`;
const DUPLICATE_NAME_ERROR = 'A sector with this name already exists.';

export { SECTOR_NAME_MAX_LENGTH };

export interface SectorNameSuccess {
  ok: true;
  name: string;
}

export interface SectorNameFailure {
  ok: false;
  error: string;
}

export type SectorNameResult = SectorNameSuccess | SectorNameFailure;

/** Rules shared by the map editor and the edit-sector modal. */
export function validateSectorName(
  value: string,
  takenNames: readonly string[] = [],
): SectorNameResult {
  const name = value.trim();
  if (!name) return { ok: false, error: EMPTY_NAME_ERROR };
  if (name.length > SECTOR_NAME_MAX_LENGTH) {
    return { ok: false, error: LONG_NAME_ERROR };
  }
  const key = name.toLowerCase();
  const taken = takenNames.some((takenName) => takenName.trim().toLowerCase() === key);
  if (taken) return { ok: false, error: DUPLICATE_NAME_ERROR };
  return { ok: true, name };
}
