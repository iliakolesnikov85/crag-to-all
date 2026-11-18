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
import Homepage from './Homepage';

const DOWNLOADED: Crag = { id: SAMPLE_CRAG_ID, cragName: 'Test Crag' };
const UNDOWNLOADED: Crag = {
  id: 'other-crag',
  cragName: 'Other Crag',
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
