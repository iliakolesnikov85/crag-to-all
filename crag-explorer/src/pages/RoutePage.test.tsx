import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it } from 'vitest';
import { CragContext } from '../context/CragContext';
import { SAMPLE_CRAG_ID, sampleCragData } from '../test/fixtures/cragData';
import RoutePage from './RoutePage';

const cragValue = {
  crag: { cragId: SAMPLE_CRAG_ID, cragName: 'Test Crag' },
  getUrl: (url: string) => url,
};

function renderRoute(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <CragContext.Provider value={cragValue}>
        <Routes>
          <Route
            path="/sector/:sectorName/:routeName"
            element={<RoutePage sectors={sampleCragData.sectors} />}
          />
        </Routes>
      </CragContext.Provider>
    </MemoryRouter>,
  );
}

describe('RoutePage lookup', () => {
  it('finds a sector and route by case-insensitive names', () => {
    renderRoute(
      `/sector/${encodeURIComponent('MaIn WaLl')}/${encodeURIComponent('cLaSsIc')}`,
    );
    expect(screen.getByRole('heading', { name: 'Classic' })).toBeInTheDocument();
    expect(screen.getByText('Grade: 6A+')).toBeInTheDocument();
  });

  it('shows not found when the sector name does not match', () => {
    renderRoute('/sector/unknown-wall/classic');
    expect(screen.getByText('Sector not found.')).toBeInTheDocument();
  });

  it('shows not found when the route name does not match', () => {
    renderRoute(`/sector/${encodeURIComponent('main wall')}/nope`);
    expect(screen.getByText('Route not found.')).toBeInTheDocument();
  });
});
