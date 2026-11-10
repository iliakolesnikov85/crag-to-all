import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { patchSector } from '../api/client';
import { CragContext } from '../context/CragContext';
import { FilterContext, useFilterState } from '../context/FilterContext';
import { SAMPLE_CRAG_ID, sampleCragData } from '../test/fixtures/cragData';
import { withQueryClient } from '../test/helpers';
import type { Sector } from '../types';
import RoutesPage from './RoutesPage';

vi.mock('../api/client', () => ({
  patchSectorGeo: vi.fn(),
}));

const cragValue = {
  crag: { cragId: SAMPLE_CRAG_ID, cragName: 'Test Crag' },
  getUrl: (url: string) => `/${url}`,
};

function withClassicVideo(): Sector[] {
  return sampleCragData.sectors.map((sector) => ({
    ...sector,
    routes: sector.routes.map((route) =>
      route.name === 'Classic'
        ? {
          ...route,
          videos: [{ url: 'https://www.youtube.com/embed/abc', addedBy: 'Ada' }],
        }
        : route,
    ),
  }));
}

function FilterHarness({ children }: { children: ReactNode }) {
  const filter = useFilterState();
  return <FilterContext.Provider value={filter}>{children}</FilterContext.Provider>;
}

const readOnlyCrag = {
  crag: { cragId: SAMPLE_CRAG_ID, cragName: 'Test Crag', source: 'external' as const },
  getUrl: (url: string) => `/${url}`,
};

function withIds(sectors: Sector[]): Sector[] {
  return sectors.map((sector) => ({
    ...sector,
    id: sector.name === 'Main Wall' ? 'sector-1' : 'sector-2',
    version: 2,
  }));
}

function renderRoutes(
  sectors: Sector[] = sampleCragData.sectors,
  crag: typeof cragValue | typeof readOnlyCrag = cragValue,
) {
  return render(
    withQueryClient(
      <MemoryRouter>
        <CragContext.Provider value={crag}>
          <FilterHarness>
            <RoutesPage sectors={sectors} />
          </FilterHarness>
        </CragContext.Provider>
      </MemoryRouter>,
    ),
  );
}

describe('RoutesPage', () => {
  it('lists routes and empty-sector placeholders with sector links', () => {
    renderRoutes();

    expect(screen.getByRole('link', { name: 'Classic' })).toHaveAttribute(
      'href',
      '/sector/main%20wall/classic',
    );
    expect(screen.getByRole('link', { name: 'Mystery' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '(no routes)' })).toHaveAttribute(
      'href',
      '/sector/empty%20sector',
    );
    expect(screen.getAllByRole('link', { name: 'Main Wall' }).length).toBeGreaterThan(0);
  });

  it('adds a beta-video link when a route has videos', () => {
    renderRoutes(withClassicVideo());

    expect(screen.getByTitle('Watch beta videos')).toHaveAttribute(
      'href',
      '/beta-videos/main%20wall/classic',
    );
  });

  it('shows no-routes when the search matches nothing', () => {
    renderRoutes();

    fireEvent.change(screen.getByLabelText('Search routes or sectors'), {
      target: { value: 'zzzz' },
    });

    expect(screen.getByText('No routes found')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Classic' })).not.toBeInTheDocument();
  });

  it('sorts by name when the Name header is clicked', () => {
    renderRoutes();

    fireEvent.click(screen.getByText('Name'));

    const names = screen.getAllByRole('link').map((link) => link.textContent);
    const classic = names.indexOf('Classic');
    const mystery = names.indexOf('Mystery');
    expect(classic).toBeGreaterThan(-1);
    expect(mystery).toBeGreaterThan(classic);

    fireEvent.click(screen.getByText('Name'));
    const reversed = screen.getAllByRole('link').map((link) => link.textContent);
    expect(reversed.indexOf('Mystery')).toBeLessThan(reversed.indexOf('Classic'));
  });
});

describe('RoutesPage options', () => {
  beforeEach(() => {
    vi.mocked(patchSector).mockReset();
  });

  it('offers route and sector edits from the last column', () => {
    renderRoutes();

    expect(screen.getByRole('columnheader', { name: 'Options' })).toBeInTheDocument();
    const classic = screen.getByRole('link', { name: 'Classic' }).closest('tr');
    if (!(classic instanceof HTMLElement)) throw new Error('Missing Classic row');
    expect(classic.querySelectorAll('td')).toHaveLength(5);
    expect(screen.queryByRole('menuitem', { name: 'Edit route details' })).not.toBeInTheDocument();

    fireEvent.click(within(classic).getByRole('button', { name: 'Options for Classic' }));

    expect(screen.getByRole('menuitem', { name: 'Edit route details' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Edit sector details' })).toBeInTheDocument();
  });

  it('offers only sector details for an empty sector', () => {
    renderRoutes();

    fireEvent.click(screen.getByRole('button', { name: 'Options for Empty Sector' }));

    expect(screen.getByRole('menuitem', { name: 'Edit sector details' })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Edit route details' })).not.toBeInTheDocument();
  });

  it('hides row options when the crag cannot be edited', () => {
    renderRoutes(sampleCragData.sectors, readOnlyCrag);

    expect(screen.queryByRole('columnheader', { name: 'Options' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Options for Classic' })).not.toBeInTheDocument();
  });

  it('shows an error when the sector cannot be edited', () => {
    renderRoutes();

    fireEvent.click(screen.getByRole('button', { name: 'Options for Classic' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Edit route details' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent(
      'This sector cannot be edited because it has no id.',
    );
  });

  it('saves route details from the list', async () => {
    const sectors = withIds(sampleCragData.sectors);
    vi.mocked(patchSector).mockResolvedValue({ ...sectors[0], version: 3 });
    renderRoutes(sectors);

    fireEvent.click(screen.getByRole('button', { name: 'Options for Classic' }));
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
        expect.objectContaining({ id: 'Classic', name: 'Direct', grade: '6A+' }),
        sectors[0].routes[1],
      ],
    });
  });

  it('opens route details when the route sector name differs by case', () => {
    const sectors = withIds(sampleCragData.sectors).map((sector) => (
      sector.name === 'Main Wall'
        ? {
          ...sector,
          routes: sector.routes.map((route) => ({ ...route, sectorName: 'main wall' })),
        }
        : sector
    ));
    renderRoutes(sectors);

    fireEvent.click(screen.getByRole('button', { name: 'Options for Classic' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Edit route details' }));

    const dialog = screen.getByRole('dialog', { name: 'Edit route' });
    expect(within(dialog).getByLabelText('Name')).toHaveValue('Classic');
  });

  it('shows an error when the route sector name matches no sector', () => {
    const sectors = withIds(sampleCragData.sectors).map((sector) => (
      sector.name === 'Main Wall'
        ? {
          ...sector,
          routes: sector.routes.map((route) => (
            route.name === 'Classic' ? { ...route, sectorName: 'Missing Wall' } : route
          )),
        }
        : sector
    ));
    renderRoutes(sectors);

    fireEvent.click(screen.getByRole('button', { name: 'Options for Classic' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Edit sector details' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('This sector could not be found.');
  });

  it('opens sector details from the list', () => {
    const sectors = withIds(sampleCragData.sectors).map((sector) => (
      sector.name === 'Main Wall' ? { ...sector, altitude: '1800m' } : sector
    ));
    renderRoutes(sectors);

    fireEvent.click(screen.getByRole('button', { name: 'Options for Classic' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Edit sector details' }));

    const dialog = screen.getByRole('dialog', { name: 'Edit sector' });
    expect(within(dialog).getByLabelText('Name')).toHaveValue('Main Wall');
    expect(within(dialog).getByLabelText('Altitude')).toHaveValue('1800');
  });
});
