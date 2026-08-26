import { Crag } from '../types';

/** Picks default crag for the current host (e.g. roshka on localhost / roshkaclimb.ge). */
export function getDefaultCragForHost(crags: Crag[]): Crag | undefined {
  if (crags.length === 0) return undefined;
  let defaultCrag = crags[0];
  const hostname = window.location.hostname;
  if (hostname === 'localhost' || hostname.includes('roshkaclimb.ge')) {
    defaultCrag = crags.find((c) => c.cragId === 'roshka') ?? defaultCrag;
  }
  return defaultCrag;
}
