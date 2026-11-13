import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { patchSector } from '../api/client';
import { signInTestUser } from '../test/authAccount';
import { CragContext } from '../context/CragContext';
import { chooseConfirm, withQueryClient } from '../test/helpers';
import { SAMPLE_CRAG_ID, sampleCragData } from '../test/fixtures/cragData';
import type { Sector } from '../types';
import RoutePage from './RoutePage';

vi.mock('../api/client', () => ({
  patchSector: vi.fn(),
}));

const cragValue = {
  crag: { cragId: SAMPLE_CRAG_ID, cragName: 'Test Crag' },
  getUrl: (url: string) => url,
};

const editableSector: Sector = {
  ...sampleCragData.sectors[0],
  id: 'sector-1',
  version: 2,
};

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}</div>;
}

function renderRoute(path: string, sectors: Sector[] = sampleCragData.sectors) {
  return render(
    withQueryClient(
      <MemoryRouter initialEntries={[path]}>
        <CragContext.Provider value={cragValue}>
          <Routes>
            <Route
              path="/sector/:sectorName/:routeName"
              element={<RoutePage sectors={sectors} />}
            />
          </Routes>
        </CragContext.Provider>
      </MemoryRouter>,
    ),
  );
}

function openRouteOptions() {
  fireEvent.click(screen.getByRole('button', { name: 'Route options' }));
}

describe('RoutePage lookup', () => {
  beforeEach(() => {
    vi.mocked(patchSector).mockReset();
  });

  it('finds a sector and route by case-insensitive names', () => {
    renderRoute(
      `/sector/${encodeURIComponent('MaIn WaLl')}/${encodeURIComponent('cLaSsIc')}`,
    );
    expect(screen.getByRole('heading', { name: 'Classic' })).toBeInTheDocument();
    expect(screen.getByText('Grade: 6A+')).toBeInTheDocument();
  });

  it('shows the height below the description', () => {
    const sectors = sampleCragData.sectors.map((sector) => (
      sector.name === 'Main Wall'
        ? {
          ...sector,
          routes: sector.routes.map((route) => (
            route.name === 'Classic'
              ? { ...route, description: 'A steep start', height: 12 }
              : route
          )),
        }
        : sector
    ));
    renderRoute(`/sector/${encodeURIComponent('main wall')}/classic`, sectors);

    const description = screen.getByText('A steep start');
    const height = screen.getByText('Height: 12 m');
    expect(description.compareDocumentPosition(height) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
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

describe('RoutePage options', () => {
  beforeEach(() => {
    signInTestUser();
    vi.mocked(patchSector).mockReset();
  });

  it('hides the options menu when the crag cannot be edited', () => {
    render(
      withQueryClient(
        <MemoryRouter initialEntries={['/sector/main%20wall/classic']}>
          <CragContext.Provider
            value={{
              ...cragValue,
              crag: { ...cragValue.crag, source: 'external' },
            }}
          >
            <Routes>
              <Route
                path="/sector/:sectorName/:routeName"
                element={<RoutePage sectors={[editableSector]} />}
              />
            </Routes>
          </CragContext.Provider>
        </MemoryRouter>,
      ),
    );

    expect(screen.queryByRole('button', { name: 'Route options' })).not.toBeInTheDocument();
  });

  it('opens a menu with edit and delete', () => {
    renderRoute('/sector/main%20wall/classic', [editableSector]);

    expect(screen.queryByRole('menuitem', { name: 'Edit route details' })).not.toBeInTheDocument();
    openRouteOptions();
    expect(screen.getByRole('menuitem', { name: 'Edit route details' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Delete route' })).toBeInTheDocument();
  });

  it('opens route details and saves them', async () => {
    vi.mocked(patchSector).mockResolvedValue({ ...editableSector, version: 3 });
    renderRoute('/sector/main%20wall/classic', [editableSector]);
    openRouteOptions();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Edit route details' }));

    const dialog = screen.getByRole('dialog', { name: 'Edit route' });
    expect(within(dialog).getByLabelText('Name')).toHaveValue('Classic');
    fireEvent.change(within(dialog).getByLabelText('Name'), { target: { value: 'Direct' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Edit route' })).not.toBeInTheDocument();
    });
    expect(patchSector).toHaveBeenCalledWith(SAMPLE_CRAG_ID, 'sector-1', 2, {
      routes: [
        expect.objectContaining({ id: 'Classic', name: 'Direct' }),
        editableSector.routes[1],
      ],
    });
  });

  it('opens the new route address after a rename', async () => {
    vi.mocked(patchSector).mockResolvedValue({ ...editableSector, version: 3 });
    render(
      withQueryClient(
        <MemoryRouter initialEntries={['/sector/main%20wall/classic']}>
          <CragContext.Provider value={cragValue}>
            <Routes>
              <Route
                path="/sector/:sectorName/:routeName"
                element={
                  <>
                    <LocationProbe />
                    <RoutePage sectors={[editableSector]} />
                  </>
                }
              />
            </Routes>
          </CragContext.Provider>
        </MemoryRouter>,
      ),
    );

    openRouteOptions();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Edit route details' }));
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Direct' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(screen.getByTestId('location')).toHaveTextContent('/sector/main%20wall/direct');
    });
  });

  it('leaves the route in place when deletion is cancelled', () => {
    renderRoute('/sector/main%20wall/classic', [editableSector]);
    openRouteOptions();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Delete route' }));

    expect(screen.getByRole('dialog', { name: 'Delete route' })).toHaveTextContent(
      'Delete the "Classic" route?',
    );
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();
    chooseConfirm('Delete route', 'Cancel');
    expect(patchSector).not.toHaveBeenCalled();
    expect(screen.getByRole('heading', { name: 'Classic' })).toBeInTheDocument();
  });

  it('deletes the route after confirmation and leaves the page', async () => {
    vi.mocked(patchSector).mockResolvedValue({
      ...editableSector,
      version: 3,
      routes: [editableSector.routes[1]],
    });
    render(
      withQueryClient(
        <MemoryRouter initialEntries={['/sector/main%20wall/classic']}>
          <CragContext.Provider value={cragValue}>
            <Routes>
              <Route
                path="/sector/:sectorName/:routeName"
                element={<RoutePage sectors={[editableSector]} />}
              />
              <Route path="/sector/:sectorName" element={<div>Sector page</div>} />
            </Routes>
          </CragContext.Provider>
        </MemoryRouter>,
      ),
    );

    openRouteOptions();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Delete route' }));
    chooseConfirm('Delete route', 'Delete');

    await waitFor(() => {
      expect(screen.getByText('Sector page')).toBeInTheDocument();
    });
    expect(patchSector).toHaveBeenCalledWith(SAMPLE_CRAG_ID, 'sector-1', 2, {
      routes: [editableSector.routes[1]],
    });
  });

  it('shows an error when the sector cannot be edited', () => {
    renderRoute('/sector/main%20wall/classic');
    openRouteOptions();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Delete route' }));

    expect(screen.queryByRole('dialog', { name: 'Delete route' })).not.toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent(
      'This sector cannot be edited because it has no id.',
    );
    expect(patchSector).not.toHaveBeenCalled();
  });

  it('shows an error when deletion fails', async () => {
    vi.mocked(patchSector).mockRejectedValue(new Error('Failed to delete route (500)'));
    renderRoute('/sector/main%20wall/classic', [editableSector]);
    openRouteOptions();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Delete route' }));
    chooseConfirm('Delete route', 'Delete');

    expect(await screen.findByRole('alert')).toHaveTextContent('Failed to delete route (500)');
    expect(screen.getByRole('heading', { name: 'Classic' })).toBeInTheDocument();
  });
});
