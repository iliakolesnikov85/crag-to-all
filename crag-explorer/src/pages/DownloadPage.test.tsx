import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppOnlineProvider } from '../context/AppOnlineContext';
import { CragContext } from '../context/CragContext';
import { SAMPLE_CRAG_ID, sampleCragData, sampleCrags } from '../test/fixtures/cragData';
import { setNavigatorOnLine } from '../test/helpers';
import {
  estimateCragOfflineSize,
  estimateStorage,
  getOfflineManifest,
  isCragOffline,
  isOfflineDataOutdated,
} from '../utils/offline';
import DownloadPage from './DownloadPage';

vi.mock('../utils/offline', () => ({
  estimateCragOfflineSize: vi.fn(),
  estimateStorage: vi.fn(),
  getOfflineManifest: vi.fn(),
  isCragOffline: vi.fn(),
  isOfflineDataOutdated: vi.fn(),
  removeCragOffline: vi.fn(),
  syncCragOffline: vi.fn(),
}));

const cragOffline = vi.mocked(isCragOffline);
const outdated = vi.mocked(isOfflineDataOutdated);
const manifest = vi.mocked(getOfflineManifest);
const packSize = vi.mocked(estimateCragOfflineSize);
const storage = vi.mocked(estimateStorage);

function renderDownloadPage() {
  return render(
    <AppOnlineProvider>
      <CragContext.Provider
        value={{
          crag: sampleCrags[0],
          getUrl: (url: string) => url,
        }}
      >
        <DownloadPage cragData={sampleCragData} />
      </CragContext.Provider>
    </AppOnlineProvider>,
  );
}

describe('DownloadPage update and remove states', () => {
  beforeEach(() => {
    cragOffline.mockResolvedValue(true);
    outdated.mockResolvedValue(false);
    manifest.mockResolvedValue({
      cragId: SAMPLE_CRAG_ID,
      cragName: 'Test Crag',
      imageFiles: [],
      downloadedAt: 1,
      lastSyncedAt: 2,
      jsonChecksum: 'abc',
    });
    packSize.mockResolvedValue(1024);
    storage.mockResolvedValue({ usage: 1, quota: 10 });
  });

  it('shows Update when the saved pack is outdated and online', async () => {
    outdated.mockResolvedValue(true);
    renderDownloadPage();

    expect(
      await screen.findByRole('button', { name: 'Update offline data' }),
    ).toBeEnabled();
    expect(
      screen.getByRole('button', { name: 'Remove offline data' }),
    ).toBeEnabled();
    expect(
      screen.queryByText(/Saved copy is up to date/),
    ).not.toBeInTheDocument();
  });

  it('disables Remove while offline so the only saved copy is kept', async () => {
    setNavigatorOnLine(false);
    renderDownloadPage();

    const remove = await screen.findByRole('button', {
      name: 'Remove offline data',
    });
    expect(remove).toBeDisabled();
    expect(remove).toHaveAttribute(
      'title',
      'Connect to the internet before removing offline data',
    );
    expect(
      screen.getByText(/Removal is disabled while offline/),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Update offline data' }),
    ).not.toBeInTheDocument();
  });
});
