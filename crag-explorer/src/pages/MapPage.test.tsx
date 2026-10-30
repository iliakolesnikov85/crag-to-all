import { fireEvent, render, screen } from '@testing-library/react';
import { useState, type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { FilterContext, useFilter, useFilterState } from '../context/FilterContext';
import { sampleCragData } from '../test/fixtures/cragData';
import type { CragData, Route, Sector } from '../types';
import MapPage from './MapPage';

vi.mock('../components/MapWidget', () => ({
  default: ({
    cragData,
    onSectorCreated,
  }: {
    cragData: CragData;
    onSectorCreated?: (sector: Sector) => void;
  }) => (
    <div>
      <div data-testid="map-widget">
        {cragData.sectors.map((sector) => sector.name).join('|')}
      </div>
      <button
        type="button"
        onClick={() => onSectorCreated?.({
          id: 'north',
          name: 'North Wall',
          version: 1,
          geo: { lat: 1, lon: 2 },
          routes: [],
          images: [],
        })}
      >
        Create sector
      </button>
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

  it('resets filters when a sector is created so the new pin stays on the map', () => {
    const wallRoutes: Route[] = [
      {
        name: 'Classic',
        grade: '6A+',
        sectorName: 'Main Wall',
        description: '',
        tags: [],
        images: [],
      },
      {
        name: 'Pump',
        grade: '6B',
        sectorName: 'Main Wall',
        description: '',
        tags: [],
        images: [],
      },
      {
        name: 'Hard',
        grade: '6C',
        sectorName: 'Main Wall',
        description: '',
        tags: [],
        images: [],
      },
    ];
    const sectors: Sector[] = [
      { name: 'Main Wall', geo: { lat: 1, lon: 2 }, routes: wallRoutes, images: [] },
      { name: 'Empty Sector', geo: { lat: 3, lon: 4 }, routes: [], images: [] },
    ];

    function GradeProbe() {
      const filter = useFilter();
      return (
        <>
          <button type="button" onClick={() => filter.setGradeRange([2, 2])}>
            Narrow grades
          </button>
          <div data-testid="filter-probe">
            {`${filter.gradeRange[0]}-${filter.gradeRange[1]}|${filter.textFilter}|${filter.hideSectorsWithoutRoutes}|${filter.hideUnknownGrades}`}
          </div>
        </>
      );
    }

    function Harness() {
      const [cragData, setCragData] = useState<CragData>({
        ...sampleCragData,
        sectors,
      });
      return (
        <FilterHarness>
          <GradeProbe />
          <MapPage
            cragData={cragData}
            onSectorCreated={(sector) => {
              setCragData((current) => ({
                ...current,
                sectors: [...current.sectors, sector],
              }));
            }}
          />
        </FilterHarness>
      );
    }

    render(<Harness />);

    expect(screen.getByTestId('filter-probe')).toHaveTextContent('0-2||false|false');
    expect(screen.getByTestId('map-widget')).toHaveTextContent('Main Wall|Empty Sector');

    fireEvent.click(screen.getByRole('button', { name: 'Narrow grades' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Hide sectors without routes' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Hide ? grade' }));
    fireEvent.change(screen.getByLabelText('Search routes or sectors'), {
      target: { value: 'hard' },
    });

    expect(screen.getByTestId('map-widget')).toHaveTextContent('Main Wall');
    expect(screen.getByTestId('map-widget')).not.toHaveTextContent('Empty Sector');

    fireEvent.click(screen.getByRole('button', { name: 'Create sector' }));

    expect(screen.getByTestId('filter-probe')).toHaveTextContent('0-2||false|false');
    expect(screen.getByLabelText('Search routes or sectors')).toHaveValue('');
    expect(screen.getByTestId('map-widget')).toHaveTextContent('Main Wall|Empty Sector|North Wall');
  });
});
