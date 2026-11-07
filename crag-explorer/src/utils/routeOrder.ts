import type { LinePoint, Route } from '../types';

function imageRouteIndex(route: Route, imageFile: string): number | undefined {
  return route.images.find((image) => image.imageFile === imageFile)?.routeIndex;
}

function nextImageRouteIndex(routes: readonly Route[], imageFile: string): number {
  let max = -1;
  for (const route of routes) {
    const routeIndex = imageRouteIndex(route, imageFile);
    if (routeIndex !== undefined && routeIndex > max) max = routeIndex;
  }
  return max + 1;
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

/** Store a line for one route on one topo. A route not yet on that image is appended. */
function setRouteLineOnImage(
  routes: readonly Route[],
  sourceIndex: number,
  imageFile: string,
  line: readonly LinePoint[],
): Route[] | null {
  if (sourceIndex < 0 || sourceIndex >= routes.length) return null;
  const points = line.map((point) => ({ x: point.x, y: point.y }));
  const routeIndex = nextImageRouteIndex(routes, imageFile);
  return routes.map((route, index) => {
    if (index !== sourceIndex) return route;
    const onImage = route.images.some((image) => image.imageFile === imageFile);
    if (onImage) {
      return {
        ...route,
        images: route.images.map((image) => (
          image.imageFile === imageFile ? { ...image, line: points } : image
        )),
      };
    }
    return {
      ...route,
      images: [...route.images, { imageFile, routeIndex, line: points }],
    };
  });
}

/** Drop one topo image from a route. The route itself stays in the sector. */
function removeRouteFromImage(
  routes: readonly Route[],
  sourceIndex: number,
  imageFile: string,
): Route[] | null {
  const route = routes[sourceIndex];
  if (!route?.images.some((image) => image.imageFile === imageFile)) return null;
  return routes.map((item, index) => {
    if (index !== sourceIndex) return item;
    return {
      ...item,
      images: item.images.filter((image) => image.imageFile !== imageFile),
    };
  });
}

export { moveRouteOnImage, removeRouteFromImage, setRouteLineOnImage };
