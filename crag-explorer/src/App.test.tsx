import { act, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { getCragApiUrl, getCragsApiUrl } from './api/client';
import { AppRoutes } from './App';
import { setAuthAccount, setAuthPending } from './auth/session';
import { signInTestUser } from './test/authAccount';
import { AppOnlineProvider } from './context/AppOnlineContext';
import { SAMPLE_CRAG_ID, sampleCragData, sampleCrags } from './test/fixtures/cragData';
import { jsonResponse, requestUrl, withQueryClient } from './test/helpers';
import { getOfflineCragIndex, putOfflineCragIndex } from './utils/offline';

vi.mock('./components/MapWidget', () => ({
  default: () => null,
}));

function renderApp(path = '/') {
  return render(
    withQueryClient(
      <AppOnlineProvider>
        <MemoryRouter initialEntries={[path]}>
          <AppRoutes />
        </MemoryRouter>
      </AppOnlineProvider>,
    ),
  );
}

function mockIndexOk(): void {
  vi.mocked(fetch).mockImplementation((input) => {
    const url = requestUrl(input);
    if (url === getCragsApiUrl()) {
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

  it('replaces a signed-in offline index after the signed-out catalog loads', async () => {
    signInTestUser();
    const visible = { id: SAMPLE_CRAG_ID, cragName: 'Test Crag', published: true };
    const hidden = { id: 'draft', cragName: 'Draft Crag', published: false };
    let signedIn = true;
    vi.mocked(fetch).mockImplementation(() => (
      Promise.resolve(jsonResponse(signedIn ? [visible, hidden] : [visible]))
    ));

    renderApp('/');

    expect(await screen.findByRole('heading', { name: 'Draft Crag' })).toBeInTheDocument();
    expect(await getOfflineCragIndex()).toEqual([visible, hidden]);

    signedIn = false;
    act(() => {
      setAuthAccount(null);
    });

    expect(await screen.findByRole('heading', { name: 'Test Crag' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Draft Crag' })).not.toBeInTheDocument();
    expect(await getOfflineCragIndex()).toEqual([visible]);
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

  it('stays online when the crag index returns 401', async () => {
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {});
    await putOfflineCragIndex(sampleCrags);
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ error: 'unauthorized' }, 401));

    renderApp('/');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Sign-in was rejected. Log out and log in again.',
    );
    expect(screen.queryByText(/you are offline/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('status', { name: /you're offline/i })).not.toBeInTheDocument();
    expect(screen.queryByText('Test Crag')).not.toBeInTheDocument();
    errorLog.mockRestore();
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

  it('does not open a crag when the url has no crag id', async () => {
    mockIndexOk();
    renderApp('/overview');

    expect(
      await screen.findByRole('heading', { name: 'Page Not Found' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Choose a crag' })).toHaveAttribute(
      'href',
      '/',
    );
    expect(screen.queryByText('Loading crag data...')).not.toBeInTheDocument();
  });

  it('titles a route page from the sector and route in the url', async () => {
    const originalTitle = document.title;
    vi.mocked(fetch).mockImplementation((input) => {
      const url = requestUrl(input);
      if (url === getCragsApiUrl()) return Promise.resolve(jsonResponse(sampleCrags));
      if (url === getCragApiUrl(SAMPLE_CRAG_ID)) return Promise.resolve(jsonResponse(sampleCragData));
      return Promise.reject(new Error(`unexpected fetch: ${url}`));
    });

    renderApp(`/${SAMPLE_CRAG_ID}/sector/${encodeURIComponent('main wall')}/${encodeURIComponent('classic')}`);

    await vi.waitFor(() => {
      expect(document.title).toBe('Classic - Main Wall | Test Crag Climbing');
    });
    document.title = originalTitle;
  });

  it('shows a load error when offline JSON fails and no pack is saved', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.mocked(fetch).mockImplementation((input) => {
      const url = requestUrl(input);
      if (url === getCragsApiUrl()) {
        return Promise.resolve(jsonResponse(sampleCrags));
      }
      if (url === getCragApiUrl(SAMPLE_CRAG_ID)) {
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

  it('keeps a crag page on the loading screen until sign-in is known', async () => {
    setAuthPending();
    vi.mocked(fetch).mockImplementation((input) => {
      const url = requestUrl(input);
      if (url === getCragsApiUrl()) {
        return Promise.resolve(jsonResponse(sampleCrags));
      }
      if (url === getCragApiUrl(SAMPLE_CRAG_ID)) {
        return Promise.resolve(jsonResponse(sampleCragData));
      }
      return Promise.reject(new Error(`unexpected fetch: ${url}`));
    });

    renderApp(`/${SAMPLE_CRAG_ID}/routes`);

    expect(screen.getByText('Loading crags list...')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Page Not Found' })).not.toBeInTheDocument();
    expect(vi.mocked(fetch)).not.toHaveBeenCalled();

    act(() => {
      signInTestUser();
    });

    expect(await screen.findByText('Classic')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Page Not Found' })).not.toBeInTheDocument();
  });

  it('keeps crag management on the loading screen until sign-in is known', async () => {
    setAuthPending();
    vi.mocked(fetch).mockImplementation(() => Promise.resolve(jsonResponse([])));

    renderApp('/crag-manage');

    expect(screen.getByText('Loading crags list...')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Page Not Found' })).not.toBeInTheDocument();
    expect(vi.mocked(fetch)).not.toHaveBeenCalled();

    act(() => {
      signInTestUser();
    });

    expect(await screen.findByRole('button', { name: 'Add crag' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Page Not Found' })).not.toBeInTheDocument();
  });

  it('opens crag management from an empty catalog for a superadmin', async () => {
    signInTestUser();
    vi.mocked(fetch).mockImplementation(() => Promise.resolve(jsonResponse([])));
    renderApp('/crag-manage');

    expect(await screen.findByRole('button', { name: 'Add crag' })).toBeInTheDocument();
    expect(screen.getByText('No crags yet.')).toBeInTheDocument();
  });

  it('opens the about page from the footer link path', async () => {
    mockIndexOk();
    renderApp('/about');

    expect(
      await screen.findByRole('heading', { name: 'About Roshka Team' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Created by Roshka Team' })).toHaveAttribute(
      'href',
      '/about',
    );
  });

  it('hides crag management from visitors who are not superadmins', async () => {
    mockIndexOk();
    renderApp('/crag-manage');

    expect(await screen.findByRole('heading', { name: 'Page Not Found' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add crag' })).not.toBeInTheDocument();
  });
});
