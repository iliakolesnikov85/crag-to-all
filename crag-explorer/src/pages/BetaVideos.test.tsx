import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it } from 'vitest';
import { CragContext } from '../context/CragContext';
import { SAMPLE_CRAG_ID, sampleCragData } from '../test/fixtures/cragData';
import type { Sector } from '../types';
import BetaVideos from './BetaVideos';

const cragValue = {
  crag: { cragId: SAMPLE_CRAG_ID, cragName: 'Test Crag' },
  getUrl: (url: string) => url,
};

const classicPath = `/beta-videos/${encodeURIComponent('MAIN WALL')}/${encodeURIComponent('classic')}`;

function withClassicVideos(): Sector[] {
  return sampleCragData.sectors.map((sector) => ({
    ...sector,
    routes: sector.routes.map((route) =>
      route.name === 'Classic'
        ? {
            ...route,
            videos: [
              {
                url: 'https://www.youtube.com/embed/abc',
                addedBy: 'Ada',
              },
            ],
          }
        : route,
    ),
  }));
}

function renderBeta(path: string, sectors: Sector[] = sampleCragData.sectors) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <CragContext.Provider value={cragValue}>
        <Routes>
          <Route
            path="/beta-videos/:sectorName/:routeName"
            element={<BetaVideos sectors={sectors} />}
          />
        </Routes>
      </CragContext.Provider>
    </MemoryRouter>,
  );
}

describe('BetaVideos lookup', () => {
  it('finds a route by case-insensitive names and lists its videos', () => {
    renderBeta(classicPath, withClassicVideos());

    expect(screen.getByText('Classic')).toBeInTheDocument();
    expect(screen.getByText('6A+')).toBeInTheDocument();
    expect(
      screen.getByTitle('Classic beta video 1'),
    ).toBeInTheDocument();
    expect(screen.getByText('Added by Ada')).toBeInTheDocument();
  });

  it('shows an empty message when the matched route has no videos', () => {
    renderBeta(classicPath);
    expect(
      screen.getByText('No beta videos available for this route.'),
    ).toBeInTheDocument();
  });

  it('shows not found when the sector name does not match', () => {
    renderBeta('/beta-videos/unknown-wall/classic');
    expect(screen.getByText('Sector not found.')).toBeInTheDocument();
  });

  it('shows not found when the route name does not match', () => {
    renderBeta(`/beta-videos/${encodeURIComponent('main wall')}/nope`);
    expect(screen.getByText('Route not found.')).toBeInTheDocument();
  });
});
