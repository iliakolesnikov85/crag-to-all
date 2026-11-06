import type { Route } from '../types';

function imageRouteIndex(route: Route, imageFile: string): number | undefined {
  return route.images.find((image) => image.imageFile === imageFile)?.routeIndex;
}

function withImageRouteIndex(route: Route, imageFile: string, routeIndex: number): Route {
  let changed = false;
  const images = route.images.map((image) => {
    if (image.imageFile !== imageFile || image.routeIndex === routeIndex) return image;
    changed = true;
    return { ...image, routeIndex };
  });
  return changed ? { ...route, images } : route;
}

/** Reorder a route among the routes drawn on one topo image. Other images stay put. */
function moveRouteOnImage(
  routes: readonly Route[],
  imageFile: string,
  index: number,
  direction: -1 | 1,
): Route[] | null {
  const ordered = routes
    .map((route, sourceIndex) => ({
      sourceIndex,
      routeIndex: imageRouteIndex(route, imageFile),
    }))
    .filter((item): item is { sourceIndex: number; routeIndex: number } => item.routeIndex !== undefined)
    .sort((a, b) => a.routeIndex - b.routeIndex || a.sourceIndex - b.sourceIndex);

  const target = index + direction;
  if (index < 0 || index >= ordered.length || target < 0 || target >= ordered.length) return null;

  const nextOrder = ordered.slice();
  const [moved] = nextOrder.splice(index, 1);
  nextOrder.splice(target, 0, moved);
  const indexBySource = new Map(nextOrder.map((item, order) => [item.sourceIndex, order]));

  return routes.map((route, sourceIndex) => {
    const order = indexBySource.get(sourceIndex);
    if (order === undefined) return route;
    return withImageRouteIndex(route, imageFile, order);
  });
}

export { moveRouteOnImage };
