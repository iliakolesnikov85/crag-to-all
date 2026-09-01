import type { CragData, Route, Sector } from '../../types';

const WALL_IMAGE = 'wall.jpg';

function makeRoute(
  overrides: Partial<Route> & Pick<Route, 'name' | 'grade'>,
): Route {
  return {
    sectorName: 'Main Wall',
    description: '',
    tags: [],
    images: [],
    ...overrides,
  };
}

const mainWall: Sector = {
  name: 'Main Wall',
  geo: '42.1234, 44.5678',
  routes: [
    makeRoute({
      name: 'Classic',
      grade: '6A+',
      images: [{ imageFile: WALL_IMAGE, routeIndex: 0 }],
    }),
    makeRoute({ name: 'Mystery', grade: '?' }),
  ],
  images: [{ imageFile: WALL_IMAGE }],
};

const emptySector: Sector = {
  name: 'Empty Sector',
  geo: null,
  routes: [],
  images: [],
};

export const SAMPLE_CRAG_ID = 'test-crag';

export const SAMPLE_IMAGE_FILE = WALL_IMAGE;

export const sampleCragData: CragData = {
  name: 'Test Crag',
  sectors: [mainWall, emptySector],
  description: [],
};
