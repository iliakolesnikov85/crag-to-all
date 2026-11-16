const CRAGS_PREFIX = 'crags';

/** Storage object path `crags/<cragId>/<parts...>`. */
export function cragStoragePath(cragId: string, ...parts: string[]): string {
  return [CRAGS_PREFIX, cragId, ...parts].join('/');
}
