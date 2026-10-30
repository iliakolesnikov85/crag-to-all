import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { deleteSector } from '../api/client';
import { canEditCrag } from '../api/permissions';
import { createAppQueryClient, queryKeys } from '../api/queryClient';
import { CragContext } from '../context/CragContext';
import { withQueryClient } from '../test/helpers';
import { SAMPLE_CRAG_ID, sampleCragData } from '../test/fixtures/cragData';
import type { CragData, Sector } from '../types';
import SectorPage from './SectorPage';

vi.mock('../api/permissions', () => ({
  canEditCrag: vi.fn(() => true),
}));

vi.mock('../api/client', () => ({
  deleteSector: vi.fn(),
}));

const cragValue = {
  crag: { cragId: SAMPLE_CRAG_ID, cragName: 'Test Crag' },
  getUrl: (url: string) => url,
};

const deletableSector: Sector = {
  ...sampleCragData.sectors[0],
  id: 'sector-1',
};

const keptSector: Sector = {
  ...sampleCragData.sectors[1],
  id: 'sector-2',
};

function renderSector(path: string) {
  return render(
    withQueryClient(
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
    ),
  );
}

function renderDeletable(sector: Sector = deletableSector) {
  const client = createAppQueryClient();
  client.setQueryData<CragData>(queryKeys.crag(SAMPLE_CRAG_ID), {
    ...sampleCragData,
    sectors: [sector, keptSector],
  });
  render(
    withQueryClient(
      <MemoryRouter initialEntries={[`/sector/${encodeURIComponent(sector.name)}`]}>
        <CragContext.Provider value={cragValue}>
          <Routes>
            <Route
              path="/sector/:sectorName"
              element={<SectorPage sectors={[sector]} />}
            />
            <Route path="/routes" element={<div>Routes list</div>} />
          </Routes>
        </CragContext.Provider>
      </MemoryRouter>,
      client,
    ),
  );
  return client;
}

function openDeleteItem() {
  fireEvent.click(screen.getByRole('button', { name: 'Sector options' }));
  fireEvent.click(screen.getByRole('menuitem', { name: 'Delete sector' }));
}

describe('SectorPage lookup', () => {
  beforeEach(() => {
    vi.mocked(canEditCrag).mockReturnValue(true);
    vi.mocked(deleteSector).mockReset();
  });

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

describe('SectorPage delete', () => {
  beforeEach(() => {
    vi.mocked(canEditCrag).mockReturnValue(true);
    vi.mocked(deleteSector).mockReset();
  });

  it('hides the options menu when the crag cannot be edited', () => {
    vi.mocked(canEditCrag).mockReturnValue(false);
    renderDeletable();

    expect(screen.queryByRole('button', { name: 'Sector options' })).not.toBeInTheDocument();
  });

  it('opens a menu with Delete sector', () => {
    renderDeletable();

    expect(screen.queryByRole('menuitem', { name: 'Delete sector' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Sector options' }));
    expect(screen.getByRole('menuitem', { name: 'Delete sector' })).toBeInTheDocument();
  });

  it('leaves the sector in place when deletion is cancelled', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderDeletable();

    openDeleteItem();

    expect(window.confirm).toHaveBeenCalledWith(
      'Delete the "Main Wall" sector? This permanently removes the sector and all of its routes.',
    );
    expect(deleteSector).not.toHaveBeenCalled();
    expect(screen.getByRole('heading', { name: 'Main Wall' })).toBeInTheDocument();
    vi.mocked(window.confirm).mockRestore();
  });

  it('deletes the sector after confirmation and leaves the page', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    vi.mocked(deleteSector).mockResolvedValue(undefined);
    const client = renderDeletable();

    openDeleteItem();

    await waitFor(() => {
      expect(screen.getByText('Routes list')).toBeInTheDocument();
    });
    expect(deleteSector).toHaveBeenCalledWith(SAMPLE_CRAG_ID, 'sector-1');
    expect(client.getQueryData<CragData>(queryKeys.crag(SAMPLE_CRAG_ID))?.sectors).toEqual([
      keptSector,
    ]);
    vi.mocked(window.confirm).mockRestore();
  });

  it('shows an error when the sector has no id', () => {
    const sector: Sector = { ...deletableSector, id: undefined };
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderDeletable(sector);

    openDeleteItem();

    expect(window.confirm).not.toHaveBeenCalled();
    expect(deleteSector).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(
      'This sector cannot be deleted because it has no id.',
    );
    vi.mocked(window.confirm).mockRestore();
  });

  it('shows an error when deletion fails', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    vi.mocked(deleteSector).mockRejectedValue(new Error('Failed to delete sector (500)'));
    const client = renderDeletable();

    openDeleteItem();

    expect(await screen.findByRole('alert')).toHaveTextContent('Failed to delete sector (500)');
    expect(screen.getByRole('heading', { name: 'Main Wall' })).toBeInTheDocument();
    expect(client.getQueryData<CragData>(queryKeys.crag(SAMPLE_CRAG_ID))?.sectors).toEqual([
      deletableSector,
      keptSector,
    ]);
    vi.mocked(window.confirm).mockRestore();
  });
});
