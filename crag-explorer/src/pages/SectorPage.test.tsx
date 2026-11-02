import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { useState } from 'react';
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { deleteSector, patchSectorGeo } from '../api/client';
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
  patchSectorGeo: vi.fn(),
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
    vi.mocked(patchSectorGeo).mockReset();
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
    vi.mocked(patchSectorGeo).mockReset();
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
    expect(screen.getByRole('menuitem', { name: 'Edit' })).toBeInTheDocument();
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

const editableSector: Sector = {
  ...deletableSector,
  version: 2,
  altitude: '1800m',
  approachTime: '20min',
  season: 'Jul - Aug',
  orientation: 'NE',
  timeInSun: '08:00 - 11:00',
};

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}</div>;
}

function HistoryControls() {
  const navigate = useNavigate();
  return (
    <>
      <button type="button" onClick={() => navigate(-1)}>Back</button>
      <button type="button" onClick={() => navigate(1)}>Forward</button>
    </>
  );
}

function openEditItem() {
  fireEvent.click(screen.getByRole('button', { name: 'Sector options' }));
  fireEvent.click(screen.getByRole('menuitem', { name: 'Edit' }));
}

function renderSectorAndMap() {
  render(
    withQueryClient(
      <MemoryRouter initialEntries={[`/sector/${encodeURIComponent(editableSector.name)}`]}>
        <CragContext.Provider value={cragValue}>
          <Routes>
            <Route path="/sector/:sectorName" element={<SectorPage sectors={[editableSector]} />} />
            <Route path="/map" element={<h1>Map</h1>} />
          </Routes>
        </CragContext.Provider>
      </MemoryRouter>,
    ),
  );
}

describe('SectorPage edit', () => {
  beforeEach(() => {
    vi.mocked(canEditCrag).mockReturnValue(true);
    vi.mocked(deleteSector).mockReset();
    vi.mocked(patchSectorGeo).mockReset();
  });

  it('opens an edit dialog with the sector details and a map hint', () => {
    renderDeletable(editableSector);
    openEditItem();

    expect(screen.queryByRole('menuitem', { name: 'Edit' })).not.toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Edit sector' })).toBeInTheDocument();
    expect(screen.getByLabelText('Name')).toHaveValue('Main Wall');
    expect(screen.getByLabelText('Altitude')).toHaveValue('1800');
    expect(screen.getByLabelText('Approach time')).toHaveValue('20');
    expect(screen.getByRole('button', { name: 'Jul' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Aug' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Apr' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: 'NE' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByLabelText('Time in sun from')).toHaveValue('08:00');
    expect(screen.getByLabelText('Time in sun until')).toHaveValue('11:00');
    const dialog = screen.getByRole('dialog', { name: 'Edit sector' });
    expect(within(dialog).getByText('42.1234, 44.5678')).toBeInTheDocument();
    expect(within(dialog).getByRole('link', { name: 'map' })).toHaveAttribute('href', '/map');
    expect(within(dialog).getByText(/You can change the location on the/)).toBeInTheDocument();
  });

  it('asks before leaving a changed edit for the map', () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderSectorAndMap();
    openEditItem();
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'North Wall' } });
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('link', { name: 'map' }));

    expect(confirm).toHaveBeenCalledWith('Leave this edit? Your unsaved changes will be lost.');
    expect(screen.getByRole('dialog', { name: 'Edit sector' })).toBeInTheDocument();
    expect(screen.getByLabelText('Name')).toHaveValue('North Wall');
    expect(screen.queryByRole('heading', { name: 'Map' })).not.toBeInTheDocument();
    confirm.mockRestore();
  });

  it('opens the map from a changed edit after confirmation', () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderSectorAndMap();
    openEditItem();
    fireEvent.change(screen.getByLabelText('Altitude'), { target: { value: '2100' } });
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('link', { name: 'map' }));

    expect(confirm).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('heading', { name: 'Map' })).toBeInTheDocument();
    expect(patchSectorGeo).not.toHaveBeenCalled();
    confirm.mockRestore();
  });

  it('opens the map without confirmation when the edit is unchanged', () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderSectorAndMap();
    openEditItem();
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('link', { name: 'map' }));

    expect(confirm).not.toHaveBeenCalled();
    expect(screen.getByRole('heading', { name: 'Map' })).toBeInTheDocument();
    confirm.mockRestore();
  });

  it('saves changed details', async () => {
    vi.mocked(patchSectorGeo).mockResolvedValue({
      ...editableSector,
      version: 3,
      altitude: '2100m',
      season: 'Apr; Jul - Aug',
      orientation: 'N, NW,',
      timeInSun: '02:30 -',
    });
    renderDeletable(editableSector);
    openEditItem();

    fireEvent.change(screen.getByLabelText('Altitude'), { target: { value: '2100' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apr' }));
    fireEvent.click(screen.getByRole('button', { name: 'NE' }));
    fireEvent.click(screen.getByRole('button', { name: 'N' }));
    fireEvent.click(screen.getByRole('button', { name: 'NW' }));
    fireEvent.change(screen.getByLabelText('Time in sun from'), { target: { value: '02:30' } });
    fireEvent.change(screen.getByLabelText('Time in sun until'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(patchSectorGeo).toHaveBeenCalledWith(SAMPLE_CRAG_ID, 'sector-1', 2, {
      altitude: '2100m',
      season: 'Apr; Jul - Aug',
      orientation: 'N, NW,',
      timeInSun: '02:30 -',
    });
  });

  it('renames the sector and opens the new sector address', async () => {
    const renamed: Sector = { ...editableSector, name: 'North Wall', version: 3 };
    vi.mocked(patchSectorGeo).mockResolvedValue(renamed);
    const client = createAppQueryClient();
    client.setQueryData<CragData>(queryKeys.crag(SAMPLE_CRAG_ID), {
      ...sampleCragData,
      sectors: [editableSector, keptSector],
    });
    render(
      withQueryClient(
        <MemoryRouter initialEntries={[`/sector/${encodeURIComponent(editableSector.name)}`]}>
          <CragContext.Provider value={cragValue}>
            <Routes>
              <Route
                path="/sector/:sectorName"
                element={
                  <>
                    <LocationProbe />
                    <SectorPage sectors={[editableSector]} />
                  </>
                }
              />
            </Routes>
          </CragContext.Provider>
        </MemoryRouter>,
        client,
      ),
    );

    openEditItem();
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'North Wall' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(screen.getByTestId('location')).toHaveTextContent('/sector/north%20wall');
    });
    expect(patchSectorGeo).toHaveBeenCalledWith(SAMPLE_CRAG_ID, 'sector-1', 2, {
      name: 'North Wall',
    });
    expect(client.getQueryData<CragData>(queryKeys.crag(SAMPLE_CRAG_ID))?.sectors[0]).toEqual(renamed);
  });

  it('saves the sector version from when the dialog opened', async () => {
    function ReloadableSector() {
      const [current, setCurrent] = useState(editableSector);
      return (
        <>
          <button
            type="button"
            onClick={() => setCurrent({ ...editableSector, version: 9, altitude: '3000m' })}
          >
            Reload crag
          </button>
          <SectorPage sectors={[current]} />
        </>
      );
    }

    vi.mocked(patchSectorGeo).mockImplementation(async () => ({
      ...editableSector,
      version: 3,
      altitude: '2100m',
    }));
    render(
      withQueryClient(
        <MemoryRouter initialEntries={[`/sector/${encodeURIComponent(editableSector.name)}`]}>
          <CragContext.Provider value={cragValue}>
            <Routes>
              <Route path="/sector/:sectorName" element={<ReloadableSector />} />
            </Routes>
          </CragContext.Provider>
        </MemoryRouter>,
      ),
    );

    openEditItem();
    fireEvent.change(screen.getByLabelText('Altitude'), { target: { value: '2100' } });
    fireEvent.click(screen.getByRole('button', { name: 'Reload crag' }));
    expect(screen.getByLabelText('Altitude')).toHaveValue('2100');
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(patchSectorGeo).toHaveBeenCalledWith(SAMPLE_CRAG_ID, 'sector-1', 2, {
        altitude: '2100m',
      });
    });
  });

  it('closes the edit dialog on back and forward without saving', () => {
    const otherSector: Sector = { ...keptSector, version: 1 };
    render(
      withQueryClient(
        <MemoryRouter
          initialEntries={[
            `/sector/${encodeURIComponent(otherSector.name)}`,
            `/sector/${encodeURIComponent(editableSector.name)}`,
          ]}
          initialIndex={1}
        >
          <CragContext.Provider value={cragValue}>
            <HistoryControls />
            <Routes>
              <Route
                path="/sector/:sectorName"
                element={<SectorPage sectors={[editableSector, otherSector]} />}
              />
            </Routes>
          </CragContext.Provider>
        </MemoryRouter>,
      ),
    );

    openEditItem();
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'North Wall' } });
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Empty Sector' })).toBeInTheDocument();
    expect(patchSectorGeo).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Forward' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Main Wall' })).toBeInTheDocument();
    expect(patchSectorGeo).not.toHaveBeenCalled();
  });

  it('shows an error in the dialog when saving fails', async () => {
    vi.mocked(patchSectorGeo).mockRejectedValue(new Error('Failed to save sector (500)'));
    renderDeletable(editableSector);
    openEditItem();

    fireEvent.change(screen.getByLabelText('Approach time'), { target: { value: '45' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Failed to save sector (500)');
    expect(screen.getByRole('dialog', { name: 'Edit sector' })).toBeInTheDocument();
  });

  it('shows an error when the sector has no id', () => {
    renderDeletable({ ...editableSector, id: undefined });
    openEditItem();

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent(
      'This sector cannot be edited because it has no id.',
    );
    expect(patchSectorGeo).not.toHaveBeenCalled();
  });

  it('shows an error when the sector has no version', () => {
    renderDeletable({ ...editableSector, version: undefined });
    openEditItem();

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent(
      'This sector cannot be edited because it has no version.',
    );
    expect(patchSectorGeo).not.toHaveBeenCalled();
  });
});
