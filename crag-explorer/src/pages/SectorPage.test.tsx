import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { useState } from 'react';
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { deleteSector, patchSectorGeo } from '../api/client';
import { canEditCrag } from '../api/permissions';
import { createAppQueryClient, queryKeys } from '../api/queryClient';
import { CragContext } from '../context/CragContext';
import { chooseConfirm, withQueryClient } from '../test/helpers';
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

const sectorWithoutTopos: Sector = {
  ...deletableSector,
  images: [],
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

  it('shows the route height below its description', () => {
    renderDeletable({
      ...deletableSector,
      routes: deletableSector.routes.map((route) => (
        route.name === 'Classic'
          ? { ...route, description: 'A steep start', height: 12 }
          : route
      )),
    });

    const description = screen.getByText('A steep start');
    const height = screen.getByText('Height: 12 m');
    expect(description.compareDocumentPosition(height) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
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
    expect(screen.queryByRole('button', { name: 'Options for Classic' })).not.toBeInTheDocument();
  });

  it('opens a menu with Delete sector', () => {
    renderDeletable(sectorWithoutTopos);

    expect(screen.queryByRole('menuitem', { name: 'Delete sector' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Sector options' }));
    expect(screen.getByRole('menuitem', { name: 'Edit sector details' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Delete sector' })).toBeInTheDocument();
  });

  it('hides Delete sector when the sector has topo images', () => {
    renderDeletable();

    fireEvent.click(screen.getByRole('button', { name: 'Sector options' }));
    expect(screen.getByRole('menuitem', { name: 'Edit sector details' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Routes' })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Delete sector' })).not.toBeInTheDocument();
  });

  it('leaves the sector in place when deletion is cancelled', () => {
    renderDeletable(sectorWithoutTopos);

    openDeleteItem();

    expect(screen.getByRole('dialog', { name: 'Delete sector' })).toHaveTextContent(
      'Delete the "Main Wall" sector? This permanently removes the sector and all of its routes.',
    );
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();
    chooseConfirm('Delete sector', 'Cancel');
    expect(deleteSector).not.toHaveBeenCalled();
    expect(screen.getByRole('heading', { name: 'Main Wall' })).toBeInTheDocument();
  });

  it('deletes the sector after confirmation and leaves the page', async () => {
    vi.mocked(deleteSector).mockResolvedValue(undefined);
    const client = renderDeletable(sectorWithoutTopos);

    openDeleteItem();
    chooseConfirm('Delete sector', 'Delete');

    await waitFor(() => {
      expect(screen.getByText('Routes list')).toBeInTheDocument();
    });
    expect(deleteSector).toHaveBeenCalledWith(SAMPLE_CRAG_ID, 'sector-1');
    expect(client.getQueryData<CragData>(queryKeys.crag(SAMPLE_CRAG_ID))?.sectors).toEqual([
      keptSector,
    ]);
  });

  it('shows an error when the sector has no id', () => {
    const sector: Sector = { ...sectorWithoutTopos, id: undefined };
    renderDeletable(sector);

    openDeleteItem();

    expect(screen.queryByRole('dialog', { name: 'Delete sector' })).not.toBeInTheDocument();
    expect(deleteSector).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(
      'This sector cannot be deleted because it has no id.',
    );
  });

  it('shows an error when deletion fails', async () => {
    vi.mocked(deleteSector).mockRejectedValue(new Error('Failed to delete sector (500)'));
    const client = renderDeletable(sectorWithoutTopos);

    openDeleteItem();
    chooseConfirm('Delete sector', 'Delete');

    expect(await screen.findByRole('alert')).toHaveTextContent('Failed to delete sector (500)');
    expect(screen.getByRole('heading', { name: 'Main Wall' })).toBeInTheDocument();
    expect(client.getQueryData<CragData>(queryKeys.crag(SAMPLE_CRAG_ID))?.sectors).toEqual([
      sectorWithoutTopos,
      keptSector,
    ]);
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
  fireEvent.click(screen.getByRole('menuitem', { name: 'Edit sector details' }));
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

    expect(screen.queryByRole('menuitem', { name: 'Edit sector details' })).not.toBeInTheDocument();
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
    renderSectorAndMap();
    openEditItem();
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'North Wall' } });
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Edit sector' })).getByRole('link', { name: 'map' }));

    const leave = screen.getByRole('dialog', { name: 'Leave this edit?' });
    expect(leave).toHaveTextContent('Leave this edit? Your unsaved changes will be lost.');
    expect(within(leave).getByRole('button', { name: 'Cancel' })).toHaveFocus();
    expect(screen.getByRole('dialog', { name: 'Edit sector' })).toBeInTheDocument();
    expect(screen.getByLabelText('Name')).toHaveValue('North Wall');
    expect(screen.queryByRole('heading', { name: 'Map' })).not.toBeInTheDocument();
    chooseConfirm('Leave this edit?', 'Cancel');
    expect(screen.getByRole('dialog', { name: 'Edit sector' })).toBeInTheDocument();
    expect(screen.getByLabelText('Name')).toHaveValue('North Wall');
  });

  it('opens the map from a changed edit after confirmation', async () => {
    renderSectorAndMap();
    openEditItem();
    fireEvent.change(screen.getByLabelText('Altitude'), { target: { value: '2100' } });
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Edit sector' })).getByRole('link', { name: 'map' }));
    chooseConfirm('Leave this edit?', 'Leave');

    expect(await screen.findByRole('heading', { name: 'Map' })).toBeInTheDocument();
    expect(patchSectorGeo).not.toHaveBeenCalled();
  });

  it('opens the map without confirmation when the edit is unchanged', () => {
    renderSectorAndMap();
    openEditItem();
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Edit sector' })).getByRole('link', { name: 'map' }));

    expect(screen.queryByRole('dialog', { name: 'Leave this edit?' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Map' })).toBeInTheDocument();
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

const ratedRoute: Sector = {
  ...editableSector,
  routes: [
    {
      ...editableSector.routes[0],
      id: 'route-1',
      rating: 2.5,
      ratingVotes: '10 votes',
      videos: [{ url: 'https://example.com/v', addedBy: 'Ada' }],
    },
    editableSector.routes[1],
  ],
};

function openRoutesItem() {
  fireEvent.click(screen.getByRole('button', { name: 'Sector options' }));
  fireEvent.click(screen.getByRole('menuitem', { name: 'Routes' }));
}

describe('SectorPage routes', () => {
  beforeEach(() => {
    vi.mocked(canEditCrag).mockReturnValue(true);
    vi.mocked(deleteSector).mockReset();
    vi.mocked(patchSectorGeo).mockReset();
  });

  it('hides a stored Boulder tag without removing it', async () => {
    const withBoulder: Sector = {
      ...ratedRoute,
      routes: [
        { ...ratedRoute.routes[0], tags: ['Boulder', 'Video beta'], type: 'Sport' },
        ratedRoute.routes[1],
      ],
    };
    vi.mocked(patchSectorGeo).mockResolvedValue({ ...withBoulder, version: 3 });
    renderDeletable(withBoulder);
    openRoutesItem();
    fireEvent.click(screen.getByRole('button', { name: 'Edit Classic' }));

    const dialog = screen.getByRole('dialog', { name: 'Edit route' });
    expect(within(dialog).queryByRole('button', { name: 'Boulder' })).not.toBeInTheDocument();
    expect(within(dialog).queryByRole('button', { name: 'Video beta' })).not.toBeInTheDocument();
    expect(within(dialog).getByLabelText('Type')).toHaveValue('Sport');
    fireEvent.change(within(dialog).getByLabelText('Type'), { target: { value: '' } });

    fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(patchSectorGeo).toHaveBeenCalledWith(SAMPLE_CRAG_ID, 'sector-1', 2, {
        routes: [
          expect.objectContaining({
            tags: ['Boulder', 'Video beta'],
          }),
          withBoulder.routes[1],
        ],
      });
    });
    const saved = vi.mocked(patchSectorGeo).mock.calls[0]?.[3].routes[0];
    expect(saved.type).toBeUndefined();
  });

  it('edits a route and keeps its images, videos, and id', async () => {
    vi.mocked(patchSectorGeo).mockResolvedValue({ ...ratedRoute, version: 3 });
    renderDeletable(ratedRoute);
    openRoutesItem();

    expect(screen.getByRole('dialog', { name: 'Routes' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Edit Classic' }));
    const dialog = screen.getByRole('dialog', { name: 'Edit route' });
    expect(screen.queryByRole('dialog', { name: 'Routes' })).not.toBeInTheDocument();
    expect(within(dialog).getByLabelText('Type')).toHaveValue('');
    fireEvent.change(within(dialog).getByLabelText('Type'), { target: { value: 'Sport' } });
    fireEvent.change(within(dialog).getByLabelText('Name'), { target: { value: 'Direct' } });
    fireEvent.change(within(dialog).getByLabelText('Height'), { target: { value: '5' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Crimpers' }));
    fireEvent.click(within(dialog).getByRole('button', { name: '2 stars' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Edit route' })).not.toBeInTheDocument();
    });
    expect(screen.getByRole('dialog', { name: 'Routes' })).toBeInTheDocument();
    expect(patchSectorGeo).toHaveBeenCalledWith(SAMPLE_CRAG_ID, 'sector-1', 2, {
      routes: [
        {
          id: 'route-1',
          name: 'Direct',
          grade: '6A+',
          sectorName: 'Main Wall',
          description: '',
          type: 'Sport',
          tags: ['Crimpers'],
          rating: 2,
          height: 5,
          images: ratedRoute.routes[0].images,
          videos: [{ url: 'https://example.com/v', addedBy: 'Ada' }],
        },
        ratedRoute.routes[1],
      ],
    });
  });

  it('adds a route', async () => {
    vi.mocked(patchSectorGeo).mockResolvedValue({ ...editableSector, version: 3 });
    renderDeletable(editableSector);
    openRoutesItem();
    fireEvent.click(screen.getByRole('button', { name: '+ Add' }));

    const dialog = screen.getByRole('dialog', { name: 'Add route' });
    expect(screen.queryByRole('dialog', { name: 'Routes' })).not.toBeInTheDocument();
    expect(within(dialog).getByLabelText('Grade')).toHaveValue('?');
    expect(within(dialog).getByLabelText('Type')).toHaveValue('');
    fireEvent.change(within(dialog).getByLabelText('Name'), { target: { value: 'Arete' } });
    fireEvent.change(within(dialog).getByLabelText('Grade'), { target: { value: '6B' } });
    fireEvent.change(within(dialog).getByLabelText('Description'), { target: { value: 'A steep start' } });
    fireEvent.change(within(dialog).getByLabelText('Height'), { target: { value: '4' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Roof' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Slopers' }));
    fireEvent.click(within(dialog).getByRole('button', { name: '3 stars' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(patchSectorGeo).toHaveBeenCalledWith(SAMPLE_CRAG_ID, 'sector-1', 2, {
        routes: [
          ...editableSector.routes,
          {
            id: expect.any(String),
            name: 'Arete',
            grade: '6B',
            sectorName: 'Main Wall',
            description: 'A steep start',
            tags: ['Slopers', 'Roof'],
            rating: 3,
            height: 4,
            images: [],
          },
        ],
      });
    });
    expect(screen.getByRole('dialog', { name: 'Routes' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: 'Draw "Arete" on the topo' })).not.toBeInTheDocument();
  });

  it('deletes a route after confirmation and leaves it when cancelled', async () => {
    vi.mocked(patchSectorGeo).mockResolvedValue({ ...ratedRoute, version: 3, routes: [ratedRoute.routes[1]] });
    renderDeletable(ratedRoute);
    openRoutesItem();
    fireEvent.click(screen.getByRole('button', { name: 'Delete Classic' }));

    expect(screen.getByRole('dialog', { name: 'Delete route' })).toHaveTextContent(
      'Delete the "Classic" route?',
    );
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();
    expect(patchSectorGeo).not.toHaveBeenCalled();
    chooseConfirm('Delete route', 'Cancel');

    fireEvent.click(screen.getByRole('button', { name: 'Delete Classic' }));
    chooseConfirm('Delete route', 'Delete');

    await waitFor(() => {
      expect(patchSectorGeo).toHaveBeenCalledWith(SAMPLE_CRAG_ID, 'sector-1', 2, {
        routes: [ratedRoute.routes[1]],
      });
    });
  });

  it('rejects a duplicate route name before saving', async () => {
    renderDeletable(editableSector);
    openRoutesItem();
    fireEvent.click(screen.getByRole('button', { name: 'Edit Classic' }));
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'mystery' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(screen.getByText('A route with this name already exists.')).toBeInTheDocument();
    expect(patchSectorGeo).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog', { name: 'Edit route' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: 'Routes' })).not.toBeInTheDocument();

    fireEvent.click(within(screen.getByRole('dialog', { name: 'Edit route' })).getByRole('button', { name: 'Cancel' }));
    chooseConfirm('Leave this edit?', 'Leave');

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Edit route' })).not.toBeInTheDocument();
    });
    expect(screen.getByRole('dialog', { name: 'Routes' })).toBeInTheDocument();
  });

  it('shows an error when routes cannot be opened', () => {
    renderDeletable({ ...editableSector, id: undefined });
    openRoutesItem();

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent(
      'This sector cannot be edited because it has no id.',
    );
  });

  it('opens route details from the route gear menu and saves them', async () => {
    vi.mocked(patchSectorGeo).mockResolvedValue({ ...ratedRoute, version: 3 });
    renderDeletable(ratedRoute);

    expect(screen.queryByRole('menuitem', { name: 'Edit route details' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Options for Classic' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Edit route details' }));

    const dialog = screen.getByRole('dialog', { name: 'Edit route' });
    expect(within(dialog).getByLabelText('Name')).toHaveValue('Classic');
    expect(screen.queryByRole('dialog', { name: 'Routes' })).not.toBeInTheDocument();

    fireEvent.change(within(dialog).getByLabelText('Name'), { target: { value: 'Direct' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Edit route' })).not.toBeInTheDocument();
    });
    expect(patchSectorGeo).toHaveBeenCalledWith(SAMPLE_CRAG_ID, 'sector-1', 2, {
      routes: [
        expect.objectContaining({ id: 'route-1', name: 'Direct' }),
        ratedRoute.routes[1],
      ],
    });
  });

  it('moves a route down on its topo after confirmation', async () => {
    const alpha = {
      id: 'route-a',
      name: 'Alpha',
      grade: '6A',
      sectorName: 'Main Wall',
      description: '',
      tags: [] as string[],
      images: [
        { imageFile: 'wall.jpg', routeIndex: 2, line: [{ x: 0.2, y: 0.4 }] },
        { imageFile: 'other.jpg', routeIndex: 0 },
      ],
    };
    const bravo = {
      id: 'route-b',
      name: 'Bravo',
      grade: '6B',
      sectorName: 'Main Wall',
      description: '',
      tags: [] as string[],
      images: [{ imageFile: 'wall.jpg', routeIndex: 0 }],
    };
    const charlie = {
      id: 'route-c',
      name: 'Charlie',
      grade: '6C',
      sectorName: 'Main Wall',
      description: '',
      tags: [] as string[],
      images: [{ imageFile: 'wall.jpg', routeIndex: 1 }],
    };
    const ordered: Sector = {
      ...editableSector,
      images: [{ imageFile: 'wall.jpg' }, { imageFile: 'other.jpg' }],
      routes: [alpha, bravo, charlie],
    };
    vi.mocked(patchSectorGeo).mockResolvedValue({ ...ordered, version: 3 });
    renderDeletable(ordered);

    const openRouteMenu = (topoLabel: string, routeName: string) => {
      fireEvent.keyDown(document, { key: 'Escape' });
      const heading = screen.getByRole('heading', { level: 4, name: topoLabel });
      const block = heading.closest('.topo-block');
      if (!(block instanceof HTMLElement)) throw new Error(`Missing topo ${topoLabel}`);
      const scope = within(block);
      fireEvent.click(scope.getByRole('button', { name: `Options for ${routeName}` }));
      return scope;
    };

    const firstMenu = openRouteMenu('1/2', 'Bravo');
    expect(firstMenu.queryByRole('menuitem', { name: 'Move route up' })).not.toBeInTheDocument();
    expect(firstMenu.getByRole('menuitem', { name: 'Move route down' })).toBeInTheDocument();

    const lastMenu = openRouteMenu('1/2', 'Alpha');
    expect(lastMenu.getByRole('menuitem', { name: 'Move route up' })).toBeInTheDocument();
    expect(lastMenu.queryByRole('menuitem', { name: 'Move route down' })).not.toBeInTheDocument();

    const alone = openRouteMenu('2/2', 'Alpha');
    expect(alone.queryByRole('menuitem', { name: 'Move route up' })).not.toBeInTheDocument();
    expect(alone.queryByRole('menuitem', { name: 'Move route down' })).not.toBeInTheDocument();

    fireEvent.click(openRouteMenu('1/2', 'Charlie').getByRole('menuitem', { name: 'Move route down' }));
    expect(screen.getByRole('dialog', { name: 'Move route' })).toHaveTextContent('Move route 2/3 down?');
    expect(patchSectorGeo).not.toHaveBeenCalled();
    chooseConfirm('Move route', 'Cancel');

    fireEvent.click(openRouteMenu('1/2', 'Charlie').getByRole('menuitem', { name: 'Move route down' }));
    chooseConfirm('Move route', 'Move');

    await waitFor(() => {
      expect(patchSectorGeo).toHaveBeenCalledWith(SAMPLE_CRAG_ID, 'sector-1', 2, {
        routes: [
          {
            ...alpha,
            images: [
              { imageFile: 'wall.jpg', routeIndex: 1, line: [{ x: 0.2, y: 0.4 }] },
              { imageFile: 'other.jpg', routeIndex: 0 },
            ],
          },
          bravo,
          {
            ...charlie,
            images: [{ imageFile: 'wall.jpg', routeIndex: 2 }],
          },
        ],
      });
    });
  });

  it('shows an error when route details cannot be opened', () => {
    renderDeletable({ ...editableSector, version: undefined });
    fireEvent.click(screen.getByRole('button', { name: 'Options for Classic' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Edit route details' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent(
      'This sector cannot be edited because it has no version.',
    );
  });

  it('redraws a route line from the gear menu and saves that topo only', async () => {
    const classic = {
      ...ratedRoute.routes[0],
      images: [
        {
          imageFile: 'wall.jpg',
          routeIndex: 0,
          line: [{ x: 0.1, y: 0.2 }, { x: 0.3, y: 0.4 }],
        },
        {
          imageFile: 'other.jpg',
          routeIndex: 0,
          line: [{ x: 0.5, y: 0.5 }, { x: 0.6, y: 0.6 }],
        },
      ],
    };
    const sector: Sector = {
      ...ratedRoute,
      images: [{ imageFile: 'wall.jpg' }, { imageFile: 'other.jpg' }],
      routes: [classic, ratedRoute.routes[1]],
    };
    vi.mocked(patchSectorGeo).mockResolvedValue({ ...sector, version: 3 });
    renderDeletable(sector);

    const heading = screen.getByRole('heading', { level: 4, name: '1/2' });
    const block = heading.closest('.topo-block');
    if (!(block instanceof HTMLElement)) throw new Error('Missing topo 1/2');
    const scope = within(block);
    fireEvent.click(scope.getByRole('button', { name: 'Options for Classic' }));
    fireEvent.click(scope.getByRole('menuitem', { name: 'Redraw route' }));

    const dialog = screen.getByRole('dialog', { name: 'Draw "Classic" on the topo' });
    expect(dialog.querySelector('.draw-route-line--previous')).toHaveAttribute(
      'd',
      'M 0.1 0.2 L 0.3 0.4',
    );

    const stage = dialog.querySelector('.draw-route-stage');
    if (!(stage instanceof HTMLElement)) throw new Error('Missing draw stage');
    stage.getBoundingClientRect = () => ({
      left: 0,
      top: 0,
      width: 100,
      height: 100,
      right: 100,
      bottom: 100,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });
    fireEvent.click(stage, { clientX: 10, clientY: 20 });
    fireEvent.click(stage, { clientX: 80, clientY: 90 });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Draw "Classic" on the topo' })).not.toBeInTheDocument();
    });
    expect(patchSectorGeo).toHaveBeenCalledWith(SAMPLE_CRAG_ID, 'sector-1', 2, {
      routes: [
        {
          ...classic,
          images: [
            {
              imageFile: 'wall.jpg',
              routeIndex: 0,
              line: [{ x: 0.1, y: 0.2 }, { x: 0.8, y: 0.9 }],
            },
            {
              imageFile: 'other.jpg',
              routeIndex: 0,
              line: [{ x: 0.5, y: 0.5 }, { x: 0.6, y: 0.6 }],
            },
          ],
        },
        ratedRoute.routes[1],
      ],
    });
  });

  it('removes a route from one topo image from the gear menu', async () => {
    const classic = {
      ...ratedRoute.routes[0],
      images: [
        {
          imageFile: 'wall.jpg',
          routeIndex: 0,
          line: [{ x: 0.1, y: 0.2 }, { x: 0.3, y: 0.4 }],
        },
        {
          imageFile: 'other.jpg',
          routeIndex: 0,
          line: [{ x: 0.5, y: 0.5 }, { x: 0.6, y: 0.6 }],
        },
      ],
    };
    const sector: Sector = {
      ...ratedRoute,
      images: [{ imageFile: 'wall.jpg' }, { imageFile: 'other.jpg' }],
      routes: [classic, ratedRoute.routes[1]],
    };
    vi.mocked(patchSectorGeo).mockResolvedValue({ ...sector, version: 3 });
    renderDeletable(sector);

    const heading = screen.getByRole('heading', { level: 4, name: '1/2' });
    const block = heading.closest('.topo-block');
    if (!(block instanceof HTMLElement)) throw new Error('Missing topo 1/2');
    const scope = within(block);
    fireEvent.click(scope.getByRole('button', { name: 'Options for Classic' }));
    fireEvent.click(scope.getByRole('menuitem', { name: 'Remove from topo image' }));

    expect(screen.getByRole('dialog', { name: 'Remove route' })).toHaveTextContent(
      'Remove the "Classic" route from this topo image?',
    );
    expect(patchSectorGeo).not.toHaveBeenCalled();
    expect(scope.getByText('Classic')).toBeInTheDocument();
    chooseConfirm('Remove route', 'Cancel');

    fireEvent.click(scope.getByRole('button', { name: 'Options for Classic' }));
    fireEvent.click(scope.getByRole('menuitem', { name: 'Remove from topo image' }));
    chooseConfirm('Remove route', 'Remove');

    await waitFor(() => {
      expect(patchSectorGeo).toHaveBeenCalledWith(SAMPLE_CRAG_ID, 'sector-1', 2, {
        routes: [
          {
            ...classic,
            images: [{
              imageFile: 'other.jpg',
              routeIndex: 0,
              line: [{ x: 0.5, y: 0.5 }, { x: 0.6, y: 0.6 }],
            }],
          },
          ratedRoute.routes[1],
        ],
      });
    });
  });
});

function openDrawLines(position = 1, count = 1) {
  fireEvent.keyDown(document, { key: 'Escape' });
  fireEvent.click(screen.getByRole('button', { name: `Topo image ${position} of ${count} options` }));
  fireEvent.click(screen.getByRole('menuitem', { name: 'Draw lines' }));
}

function drawLine(dialog: HTMLElement) {
  const stage = dialog.querySelector('.draw-route-stage');
  if (!(stage instanceof HTMLElement)) throw new Error('Missing draw stage');
  stage.getBoundingClientRect = () => ({
    left: 0,
    top: 0,
    width: 100,
    height: 100,
    right: 100,
    bottom: 100,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  });
  fireEvent.click(stage, { clientX: 10, clientY: 20 });
  fireEvent.click(stage, { clientX: 80, clientY: 90 });
}

describe('SectorPage draw lines', () => {
  beforeEach(() => {
    vi.mocked(canEditCrag).mockReturnValue(true);
    vi.mocked(deleteSector).mockReset();
    vi.mocked(patchSectorGeo).mockReset();
  });

  it('offers draw, redraw, edit, and remove for the topo', () => {
    renderDeletable(editableSector);
    openDrawLines();

    const dialog = screen.getByRole('dialog', { name: 'Draw lines' });
    expect(within(dialog).getByRole('button', { name: 'Redraw Classic' })).toHaveTextContent('Redraw');
    expect(within(dialog).getByRole('button', { name: 'Edit Classic' })).toHaveTextContent('Edit');
    expect(within(dialog).getByRole('button', { name: 'Remove Classic' })).toHaveTextContent('Remove');
    expect(within(dialog).queryByRole('button', { name: 'Delete Classic' })).not.toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Draw Mystery' })).toHaveTextContent('Draw');
    expect(within(dialog).queryByRole('button', { name: 'Remove Mystery' })).not.toBeInTheDocument();
    expect(within(dialog).queryByRole('button', { name: 'Delete Mystery' })).not.toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Edit Mystery' }));
    expect(screen.getByRole('dialog', { name: 'Edit route' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: 'Draw lines' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('dialog', { name: 'Draw lines' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Redraw Classic' }));
    const drawing = screen.getByRole('dialog', { name: 'Draw "Classic" on the topo' });
    fireEvent.click(within(drawing).getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('dialog', { name: 'Draw lines' })).toBeInTheDocument();
  });

  it('saves a line for a route that is not on the topo yet', async () => {
    vi.mocked(patchSectorGeo).mockResolvedValue({ ...editableSector, version: 3 });
    renderDeletable(editableSector);
    openDrawLines();
    fireEvent.click(screen.getByRole('button', { name: 'Draw Mystery' }));

    const dialog = screen.getByRole('dialog', { name: 'Draw "Mystery" on the topo' });
    drawLine(dialog);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Draw "Mystery" on the topo' })).not.toBeInTheDocument();
    });
    expect(patchSectorGeo).toHaveBeenCalledWith(SAMPLE_CRAG_ID, 'sector-1', 2, {
      routes: [
        editableSector.routes[0],
        {
          ...editableSector.routes[1],
          images: [{
            imageFile: 'wall.jpg',
            routeIndex: 1,
            line: [{ x: 0.1, y: 0.2 }, { x: 0.8, y: 0.9 }],
          }],
        },
      ],
    });
    expect(screen.getByRole('dialog', { name: 'Draw lines' })).toBeInTheDocument();
  });

  it('removes a route from the topo image without deleting it', async () => {
    vi.mocked(patchSectorGeo).mockResolvedValue({ ...editableSector, version: 3 });
    renderDeletable(editableSector);
    openDrawLines();
    fireEvent.click(screen.getByRole('button', { name: 'Remove Classic' }));

    expect(screen.getByRole('dialog', { name: 'Remove route' })).toHaveTextContent(
      'Remove the "Classic" route from this topo image?',
    );
    expect(patchSectorGeo).not.toHaveBeenCalled();
    chooseConfirm('Remove route', 'Cancel');

    fireEvent.click(screen.getByRole('button', { name: 'Remove Classic' }));
    chooseConfirm('Remove route', 'Remove');

    await waitFor(() => {
      expect(patchSectorGeo).toHaveBeenCalledWith(SAMPLE_CRAG_ID, 'sector-1', 2, {
        routes: [
          { ...editableSector.routes[0], images: [] },
          editableSector.routes[1],
        ],
      });
    });
    expect(screen.getByRole('dialog', { name: 'Draw lines' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Edit Classic' })).toBeInTheDocument();
  });

  it('opens the draw dialog after a route is added from draw lines', async () => {
    vi.mocked(patchSectorGeo).mockImplementation(async (_cragId, _sectorId, _version, patch) => ({
      ...editableSector,
      version: 3,
      routes: patch.routes ?? editableSector.routes,
    }));
    renderDeletable(editableSector);
    openDrawLines();
    fireEvent.click(screen.getByRole('button', { name: '+ Add' }));

    const editor = screen.getByRole('dialog', { name: 'Add route' });
    fireEvent.change(within(editor).getByLabelText('Name'), { target: { value: 'Arete' } });
    fireEvent.click(within(editor).getByRole('button', { name: 'Save' }));

    const drawing = await screen.findByRole('dialog', { name: 'Draw "Arete" on the topo' });
    expect(screen.queryByRole('dialog', { name: 'Add route' })).not.toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: 'Draw lines' })).not.toBeInTheDocument();

    drawLine(drawing);
    fireEvent.click(within(drawing).getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(patchSectorGeo).toHaveBeenCalledTimes(2);
    });
    expect(patchSectorGeo).toHaveBeenLastCalledWith(SAMPLE_CRAG_ID, 'sector-1', 3, {
      routes: [
        ...editableSector.routes,
        {
          id: expect.any(String),
          name: 'Arete',
          grade: '?',
          sectorName: 'Main Wall',
          description: '',
          tags: [],
          images: [{
            imageFile: 'wall.jpg',
            routeIndex: 1,
            line: [{ x: 0.1, y: 0.2 }, { x: 0.8, y: 0.9 }],
          }],
        },
      ],
    });
  });
});

const topoSector: Sector = {
  ...editableSector,
  images: [
    { imageFile: 'a.jpg' },
    { imageFile: 'b.jpg' },
    { imageFile: 'c.jpg' },
  ],
  routes: [
    {
      ...editableSector.routes[0],
      images: [{ imageFile: 'b.jpg', routeIndex: 0 }],
    },
    editableSector.routes[1],
  ],
};

function openTopoMenu(position: number) {
  fireEvent.keyDown(document, { key: 'Escape' });
  const name = `Topo image ${position} of 3 options`;
  fireEvent.click(screen.getByRole('button', { name }));
  const root = screen.getByRole('button', { name }).parentElement;
  if (!root) throw new Error(`Missing menu for topo image ${position}`);
  return within(root);
}

describe('SectorPage topo images', () => {
  beforeEach(() => {
    vi.mocked(canEditCrag).mockReturnValue(true);
    vi.mocked(deleteSector).mockReset();
    vi.mocked(patchSectorGeo).mockReset();
  });

  it('shows each topo position and hides the menu without permission', () => {
    vi.mocked(canEditCrag).mockReturnValue(false);
    renderDeletable(topoSector);

    expect(screen.getByRole('heading', { level: 4, name: '1/3' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 4, name: '2/3' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 4, name: '3/3' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Topo image/ })).not.toBeInTheDocument();
  });

  it('deletes a topo image after confirmation', async () => {
    vi.mocked(patchSectorGeo).mockResolvedValue({ ...topoSector, version: 3 });
    renderDeletable(topoSector);

    const firstMenu = openTopoMenu(1);
    expect(firstMenu.getByRole('menuitem', { name: 'Draw lines' })).toBeInTheDocument();
    expect(firstMenu.queryByRole('menuitem', { name: 'Move image up' })).not.toBeInTheDocument();
    expect(firstMenu.getByRole('menuitem', { name: 'Move image down' })).toBeInTheDocument();

    const lastMenu = openTopoMenu(3);
    expect(lastMenu.getByRole('menuitem', { name: 'Move image up' })).toBeInTheDocument();
    expect(lastMenu.queryByRole('menuitem', { name: 'Move image down' })).not.toBeInTheDocument();

    fireEvent.click(openTopoMenu(2).getByRole('menuitem', { name: 'Delete topo image' }));
    expect(screen.getByRole('dialog', { name: 'Delete topo image' })).toHaveTextContent(
      'Delete topo image 2/3?',
    );
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();
    expect(patchSectorGeo).not.toHaveBeenCalled();
    chooseConfirm('Delete topo image', 'Cancel');

    fireEvent.click(openTopoMenu(2).getByRole('menuitem', { name: 'Delete topo image' }));
    chooseConfirm('Delete topo image', 'Delete');

    await waitFor(() => {
      expect(patchSectorGeo).toHaveBeenCalledWith(SAMPLE_CRAG_ID, 'sector-1', 2, {
        images: [topoSector.images[0], topoSector.images[2]],
      });
    });
  });

  it('moves a topo image down after confirmation', async () => {
    vi.mocked(patchSectorGeo).mockResolvedValue({ ...topoSector, version: 3 });
    renderDeletable(topoSector);

    fireEvent.click(openTopoMenu(2).getByRole('menuitem', { name: 'Move image down' }));
    expect(screen.getByRole('dialog', { name: 'Move topo image' })).toHaveTextContent(
      'Move topo image 2/3 down?',
    );
    expect(screen.getByRole('button', { name: 'Move' })).toHaveFocus();
    chooseConfirm('Move topo image', 'Move');
    await waitFor(() => {
      expect(patchSectorGeo).toHaveBeenCalledWith(SAMPLE_CRAG_ID, 'sector-1', 2, {
        images: [topoSector.images[0], topoSector.images[2], topoSector.images[1]],
      });
    });
  });
});
