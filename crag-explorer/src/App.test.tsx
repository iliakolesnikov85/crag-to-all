import { act, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { AppRoutes } from './App';
import { AppOnlineProvider } from './context/AppOnlineContext';
import { SAMPLE_CRAG_ID, sampleCrags } from './test/fixtures/cragData';
import { jsonResponse, requestUrl } from './test/helpers';
import { getCragDataUrl, getCragIndexUrl } from './utils/firebaseStorage';
import { getOfflineCragIndex, putOfflineCragIndex } from './utils/offline';

vi.mock('./components/MapWidget', () => ({
  default: () => null,
}));

function renderApp(path = '/') {
  return render(
    <AppOnlineProvider>
      <MemoryRouter initialEntries={[path]}>
        <AppRoutes />
      </MemoryRouter>
    </AppOnlineProvider>,
  );
}

function mockIndexOk(): void {
  vi.mocked(fetch).mockImplementation((input) => {
    const url = requestUrl(input);
    if (url === getCragIndexUrl()) {
      return Promise.resolve(jsonResponse(sampleCrags));
    }
    return Promise.reject(new Error(`unexpected fetch: ${url}`));
  });
}

describe('App load', () => {
  it('writes the crag index to IndexedDB on a successful fetch', async () => {
    mockIndexOk();
    renderApp('/');

    expect(await screen.findByText('Test Crag')).toBeInTheDocument();
    expect(await getOfflineCragIndex()).toEqual(sampleCrags);
  });

  it('uses the cached index and marks the network limited when fetch fails', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await putOfflineCragIndex(sampleCrags);
    vi.mocked(fetch).mockRejectedValue(new Error('index down'));

    renderApp('/');

    expect(await screen.findByText('Test Crag')).toBeInTheDocument();
    expect(await screen.findByText(/you are offline/i)).toBeInTheDocument();
    warn.mockRestore();
  });

  it('shows a message when the index is empty', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse([]));

    renderApp('/');

    expect(
      await screen.findByText(
        /No crags available. Connect to the internet or download a crag for offline use first./,
      ),
    ).toBeInTheDocument();
  });

  it('shows a load error when offline JSON fails and no pack is saved', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.mocked(fetch).mockImplementation((input) => {
      const url = requestUrl(input);
      if (url === getCragIndexUrl()) {
        return Promise.resolve(jsonResponse(sampleCrags));
      }
      if (url === getCragDataUrl(SAMPLE_CRAG_ID)) {
        return Promise.reject(new Error('no json'));
      }
      return Promise.reject(new Error(`unexpected fetch: ${url}`));
    });

    renderApp(`/${SAMPLE_CRAG_ID}/overview`);

    expect(
      await screen.findByText(/Error: Failed to load crag data/),
    ).toBeInTheDocument();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('aborts the index fetch on unmount before writing IndexedDB', async () => {
    let resolveFetch: (response: Response) => void = () => {};
    vi.mocked(fetch).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveFetch = resolve;
        }),
    );

    const { unmount } = renderApp('/');
    expect(screen.getByText('Loading crags list...')).toBeInTheDocument();
    unmount();

    await act(async () => {
      resolveFetch(jsonResponse(sampleCrags));
      await new Promise((r) => setTimeout(r, 25));
    });

    expect(await getOfflineCragIndex()).toBeUndefined();
  });
});
