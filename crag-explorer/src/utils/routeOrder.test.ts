import { describe, expect, it } from 'vitest';
import type { Route } from '../types';
import { moveRouteOnImage } from './routeOrder';

function route(name: string, images: Route['images']): Route {
  return {
    name,
    grade: '6A',
    sectorName: 'Main Wall',
    description: '',
    tags: [],
    images,
  };
}

const line = [{ x: 0.2, y: 0.4 }];

const routes: Route[] = [
  route('Alpha', [
    { imageFile: 'wall.jpg', routeIndex: 2, line },
    { imageFile: 'other.jpg', routeIndex: 0 },
  ]),
  route('Bravo', [{ imageFile: 'wall.jpg', routeIndex: 0 }]),
  route('Charlie', [{ imageFile: 'wall.jpg', routeIndex: 1 }]),
  route('Elsewhere', [{ imageFile: 'cave.jpg', routeIndex: 4 }]),
];

describe('moveRouteOnImage', () => {
  it('swaps a route with its neighbor on that topo and renumbers', () => {
    const movedDown = moveRouteOnImage(routes, 'wall.jpg', 1, 1);
    expect(movedDown?.map((item) => item.name)).toEqual(['Alpha', 'Bravo', 'Charlie', 'Elsewhere']);
    expect(movedDown?.[0].images).toEqual([
      { imageFile: 'wall.jpg', routeIndex: 1, line },
      { imageFile: 'other.jpg', routeIndex: 0 },
    ]);
    expect(movedDown?.[1].images).toEqual([{ imageFile: 'wall.jpg', routeIndex: 0 }]);
    expect(movedDown?.[2].images).toEqual([{ imageFile: 'wall.jpg', routeIndex: 2 }]);
    expect(movedDown?.[3]).toBe(routes[3]);

    const movedUp = moveRouteOnImage(routes, 'wall.jpg', 2, -1);
    expect(movedUp?.[0].images[0].routeIndex).toBe(1);
    expect(movedUp?.[2].images[0].routeIndex).toBe(2);
  });

  it('breaks tied indexes by stored order', () => {
    const tied = [
      route('First', [{ imageFile: 'wall.jpg', routeIndex: 0 }]),
      route('Second', [{ imageFile: 'wall.jpg', routeIndex: 0 }]),
    ];
    const moved = moveRouteOnImage(tied, 'wall.jpg', 0, 1);
    expect(moved?.[0].images[0].routeIndex).toBe(1);
    expect(moved?.[1].images[0].routeIndex).toBe(0);
  });

  it('refuses moves past either end and unknown images', () => {
    expect(moveRouteOnImage(routes, 'wall.jpg', 0, -1)).toBeNull();
    expect(moveRouteOnImage(routes, 'wall.jpg', 2, 1)).toBeNull();
    expect(moveRouteOnImage(routes, 'missing.jpg', 0, 1)).toBeNull();
  });
});
