import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { AppOnlineProvider } from '../context/AppOnlineContext';
import { CragContext } from '../context/CragContext';
import { SAMPLE_CRAG_ID, sampleCragData } from '../test/fixtures/cragData';
import { setNavigatorOnLine } from '../test/helpers';
import type { DescriptionSection, Sector } from '../types';
import OverviewPage from './OverviewPage';

vi.mock('../components/GradeHistogram', () => ({
  default: ({ gradeData }: { gradeData: { grade: string; count: number }[] }) => (
    <div data-testid="grade-histogram">
      {gradeData.map((row) => `${row.grade}:${row.count}`).join(' ')}
    </div>
  ),
}));

const cragValue = {
  crag: { cragId: SAMPLE_CRAG_ID, cragName: 'Test Crag' },
  getUrl: (url: string) => url,
};

const description: DescriptionSection[] = [
  {
    subheader: 'Access',
    paragraphs: ['Park at the lot.', 'This second paragraph stays on Description.'],
  },
  {
    subheader: 'Season',
    paragraphs: ['Best in autumn.'],
  },
];

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

function renderOverview(
  sectors: Sector[] = sampleCragData.sectors,
  sections: DescriptionSection[] = description,
) {
  return render(
    <AppOnlineProvider>
      <MemoryRouter>
        <CragContext.Provider value={cragValue}>
          <OverviewPage description={sections} sectors={sectors} />
        </CragContext.Provider>
      </MemoryRouter>
    </AppOnlineProvider>,
  );
}

describe('OverviewPage', () => {
  it('shows only the first description paragraph and a read-more link', () => {
    renderOverview();

    expect(screen.getByRole('heading', { name: 'About Test Crag' })).toBeInTheDocument();
    expect(screen.getByText('Access')).toBeInTheDocument();
    expect(screen.getByText('Park at the lot.')).toBeInTheDocument();
    expect(
      screen.queryByText('This second paragraph stays on Description.'),
    ).not.toBeInTheDocument();
    expect(screen.queryByText('Season')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Read more...' })).toHaveAttribute(
      'href',
      '/description',
    );
  });

  it('hides the about block when description is empty', () => {
    renderOverview(sampleCragData.sectors, []);
    expect(screen.queryByText(/About /)).not.toBeInTheDocument();
  });

  it('features sectors that have routes and an image, and skips empty ones', () => {
    renderOverview();

    expect(screen.getByRole('link', { name: /Main Wall/ })).toHaveAttribute(
      'href',
      '/sector/main%20wall',
    );
    expect(screen.getByText('2 routes')).toBeInTheDocument();
    expect(screen.queryByText('Empty Sector')).not.toBeInTheDocument();
    expect(screen.getByTestId('grade-histogram')).toHaveTextContent('6A:1');
  });

  it('shows featured beta videos only while online', () => {
    renderOverview(withClassicVideo());

    expect(
      screen.getByText(/Don't watch the video if you don't want to know the beta/),
    ).toBeInTheDocument();
    expect(screen.getByTitle('Classic beta video')).toBeInTheDocument();
  });

  it('hides featured videos while offline', () => {
    setNavigatorOnLine(false);
    renderOverview(withClassicVideo());

    expect(screen.queryByTitle('Classic beta video')).not.toBeInTheDocument();
    expect(screen.queryByText(/Don't watch the video/)).not.toBeInTheDocument();
  });
});
