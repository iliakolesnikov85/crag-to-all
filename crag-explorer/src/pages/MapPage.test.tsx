import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { FilterContext, useFilterState } from '../context/FilterContext';
import { sampleCragData } from '../test/fixtures/cragData';
import type { CragData } from '../types';
import MapPage from './MapPage';

vi.mock('../components/MapWidget', () => ({
  default: ({ cragData }: { cragData: CragData }) => (
    <div data-testid="map-widget">
      {cragData.sectors.map((sector) => sector.name).join('|')}
    </div>
  ),
}));

function FilterHarness({ children }: { children: ReactNode }) {
  const filter = useFilterState();
  return <FilterContext.Provider value={filter}>{children}</FilterContext.Provider>;
}

function renderMap() {
  return render(
    <FilterHarness>
      <MapPage cragData={sampleCragData} />
    </FilterHarness>,
  );
}

describe('MapPage', () => {
  it('locks document scroll while mounted and unlocks on leave', () => {
    const { unmount } = renderMap();

    expect(document.documentElement).toHaveClass('scroll-locked');
    unmount();
    expect(document.documentElement).not.toHaveClass('scroll-locked');
  });

  it('passes filtered sectors through to the map', () => {
    renderMap();

    expect(screen.getByTestId('map-widget')).toHaveTextContent('Main Wall|Empty Sector');

    fireEvent.change(screen.getByLabelText('Search routes or sectors'), {
      target: { value: 'classic' },
    });

    expect(screen.getByTestId('map-widget')).toHaveTextContent('Main Wall');
    expect(screen.getByTestId('map-widget')).not.toHaveTextContent('Empty Sector');
  });
});
