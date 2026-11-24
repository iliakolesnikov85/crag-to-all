import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { AppOnlineProvider } from '../context/AppOnlineContext';
import { SAMPLE_CRAG_ID } from '../test/fixtures/cragData';
import { setNavigatorOnLine } from '../test/helpers';
import type { Crag } from '../types';
import {
  putOfflineManifest,
  type OfflineCragManifest,
} from '../utils/offline';
import Homepage, { groupCragsByCountry } from './Homepage';

const DOWNLOADED: Crag = { id: SAMPLE_CRAG_ID, cragName: 'Test Crag', published: true };
const UNDOWNLOADED: Crag = {
  id: 'other-crag',
  cragName: 'Other Crag',
  published: true,
  description: 'Sandstone bouldering with short approaches and plenty of new lines.',
};
const crags = [DOWNLOADED, UNDOWNLOADED];

function manifest(
  overrides: Partial<OfflineCragManifest> & Pick<OfflineCragManifest, 'cragId'>,
): OfflineCragManifest {
  return {
    cragName: overrides.cragId,
    imageFiles: [],
    downloadedAt: 1,
    lastSyncedAt: 2,
    jsonChecksum: 'abc',
    ...overrides,
  };
}

function renderHomepage() {
  return render(
    <AppOnlineProvider>
      <MemoryRouter>
        <Homepage crags={crags} />
      </MemoryRouter>
    </AppOnlineProvider>,
  );
}

describe('Homepage offline disable', () => {
  it('keeps undownloaded crags clickable while online', async () => {
    renderHomepage();

    expect(
      await screen.findByRole('link', { name: /Test Crag/ }),
    ).toHaveAttribute('href', `/${SAMPLE_CRAG_ID}/overview`);
    expect(screen.getByRole('link', { name: /Other Crag/ })).toHaveAttribute(
      'href',
      '/other-crag/overview',
    );
    expect(screen.queryByText(/You are offline/i)).not.toBeInTheDocument();
    expect(screen.getByText(/Sandstone bouldering/)).toBeInTheDocument();
    expect(
      screen.getByText('Test Crag').closest('.crag-card')?.querySelector('.crag-card__body'),
    ).toBeNull();
    expect(screen.queryByText('Unpublished')).not.toBeInTheDocument();
  });

  it('shows an Unpublished badge on cards for unpublished crags', () => {
    const unpublished: Crag = {
      id: 'draft-crag',
      cragName: 'Draft Crag',
      published: false,
    };

    render(
      <AppOnlineProvider>
        <MemoryRouter>
          <Homepage crags={[DOWNLOADED, unpublished]} />
        </MemoryRouter>
      </AppOnlineProvider>,
    );

    const badge = screen.getByText('Unpublished');
    expect(badge.closest('.crag-card')).toHaveTextContent('Draft Crag');
    expect(screen.getByText('Test Crag').closest('.crag-card')).not.toHaveTextContent(
      'Unpublished',
    );
  });

  it('disables undownloaded crags while offline and leaves saved ones openable', async () => {
    setNavigatorOnLine(false);
    await putOfflineManifest(
      manifest({ cragId: SAMPLE_CRAG_ID, cragName: 'Test Crag' }),
    );

    renderHomepage();

    expect(
      await screen.findByRole('link', { name: /Test Crag/ }),
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(
        screen.queryByRole('link', { name: /Other Crag/ }),
      ).not.toBeInTheDocument();
    });

    const disabledCard = screen.getByText('Other Crag').closest('.crag-card');
    expect(disabledCard).toHaveClass('crag-card--disabled');
    expect(
      screen.getByText('Other Crag').closest('.crag-card__link'),
    ).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByText(/You are offline/i)).toBeInTheDocument();
  });
});

describe('Homepage country groups', () => {
  const france: Crag = {
    id: 'font',
    cragName: 'Fontainebleau',
    published: true,
    country: 'FR',
  };
  const georgia: Crag = {
    id: 'roshka',
    cragName: 'Roshka',
    published: true,
    country: 'GE',
  };
  const unknown: Crag = {
    id: 'mystery',
    cragName: 'Mystery Crag',
    published: true,
  };

  it('puts the country with the same domain as the site first', () => {
    const names = groupCragsByCountry(
      [france, unknown, georgia],
      'roshkaclimb.ge',
    ).map((group) => group.name);

    expect(names).toEqual(['Georgia', 'France', 'Other']);
    expect(groupCragsByCountry([georgia, france], 'roshkaclimb.ge')[0].crags.map((crag) => crag.id))
      .toEqual(['roshka']);
  });

  it('keeps country order by name when the site domain matches none', () => {
    const names = groupCragsByCountry([georgia, france, unknown], 'localhost')
      .map((group) => group.name);

    expect(names).toEqual(['France', 'Georgia', 'Other']);
  });

  it('shows the guidebook title and the country name with its flag', () => {
    render(
      <AppOnlineProvider>
        <MemoryRouter>
          <Homepage crags={[france, georgia]} />
        </MemoryRouter>
      </AppOnlineProvider>,
    );

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Free climbing guidebooks',
    );
    const countryHeadings = screen.getAllByRole('heading', { level: 2 })
      .map((heading) => heading.textContent);
    expect(countryHeadings).toEqual(['France', 'Georgia']);
    const flags = document.querySelectorAll('.crag-country__flag');
    expect(flags[0]).toHaveAttribute('src', expect.stringContaining('flags/fr.svg'));
    expect(flags[1]).toHaveAttribute('src', expect.stringContaining('flags/ge.svg'));
  });
});
