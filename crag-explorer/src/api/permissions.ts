/**
 * Whether the current user may edit this crag.
 * Stub until real auth exists. Always allows management.
 */
export function canManageCrag(_cragId: string): boolean {
  return true;
}
