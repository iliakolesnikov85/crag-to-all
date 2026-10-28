import type { CragSource } from '../types';

/**
 * Whether the current user may edit this crag.
 * Stub until real auth exists. Always allows management.
 */
export function canManageCrag(_cragId: string): boolean {
  return true;
}

/** Extracted crags are a read-only copy. Explorer crags, and crags with no source, can be changed. */
export function canEditCrag(crag: { cragId: string; source?: CragSource }): boolean {
  return crag.source !== 'external' && canManageCrag(crag.cragId);
}
