import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { CragContext } from '../context/CragContext';
import { FilterContext, useFilterState } from '../context/FilterContext';
import { SAMPLE_CRAG_ID, sampleCragData } from '../test/fixtures/cragData';
import type { Sector } from '../types';
import RoutesPage from './RoutesPage';

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

function renderRoutes(sectors: Sector[] = sampleCragData.sectors) {
  return render(
    <MemoryRouter>
      <CragContext.Provider value={cragValue}>
        <FilterHarness>
          <RoutesPage sectors={sectors} />
        </FilterHarness>
      </CragContext.Provider>
    </MemoryRouter>,
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
