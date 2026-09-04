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
import CragSelector from './CragSelector';

const DOWNLOADED: Crag = { cragId: SAMPLE_CRAG_ID, cragName: 'Test Crag' };
const UNDOWNLOADED: Crag = { cragId: 'other-crag', cragName: 'Other Crag' };
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

function renderSelector() {
  return render(
    <AppOnlineProvider>
      <MemoryRouter>
        <CragSelector crags={crags} />
      </MemoryRouter>
    </AppOnlineProvider>,
  );
}

describe('CragSelector offline disable', () => {
  it('keeps undownloaded crags clickable while online', async () => {
    renderSelector();

    expect(
      await screen.findByRole('link', { name: /Test Crag/ }),
    ).toHaveAttribute('href', '/overview');
    expect(screen.getByRole('link', { name: /Other Crag/ })).toHaveAttribute(
      'href',
      '/other-crag/overview',
    );
    expect(screen.queryByText(/You are offline/i)).not.toBeInTheDocument();
  });

  it('disables undownloaded crags while offline and leaves saved ones openable', async () => {
    setNavigatorOnLine(false);
    await putOfflineManifest(
      manifest({ cragId: SAMPLE_CRAG_ID, cragName: 'Test Crag' }),
    );

    renderSelector();

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
