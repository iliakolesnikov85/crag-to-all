import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it } from 'vitest';
import { CragContext } from '../context/CragContext';
import { SAMPLE_CRAG_ID, sampleCragData } from '../test/fixtures/cragData';
import SectorPage from './SectorPage';

const cragValue = {
  crag: { cragId: SAMPLE_CRAG_ID, cragName: 'Test Crag' },
  getUrl: (url: string) => url,
};

function renderSector(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <CragContext.Provider value={cragValue}>
        <Routes>
          <Route
            path="/sector/:sectorName"
            element={<SectorPage sectors={sampleCragData.sectors} />}
          />
        </Routes>
      </CragContext.Provider>
    </MemoryRouter>,
  );
}

describe('SectorPage lookup', () => {
  it('finds a sector by case-insensitive name', () => {
    renderSector(`/sector/${encodeURIComponent('MAIN WALL')}`);
    expect(
      screen.getByRole('heading', { name: 'Main Wall' }),
    ).toBeInTheDocument();
  });

  it('shows not found when the sector name does not match', () => {
    renderSector('/sector/unknown-wall');
    expect(screen.getByText('Sector not found.')).toBeInTheDocument();
  });
});
