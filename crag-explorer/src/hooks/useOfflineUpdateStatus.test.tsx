import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppOnlineProvider } from '../context/AppOnlineContext';
import { SAMPLE_CRAG_ID } from '../test/fixtures/cragData';
import { setNavigatorOnLine } from '../test/helpers';
import { isOfflineDataOutdated } from '../utils/offline';
import { useOfflineUpdateStatus } from './useOfflineUpdateStatus';

vi.mock('../utils/offline', () => ({
  isOfflineDataOutdated: vi.fn(),
}));

const outdated = vi.mocked(isOfflineDataOutdated);

function wrapper({ children }: { children: ReactNode }) {
  return <AppOnlineProvider>{children}</AppOnlineProvider>;
}

describe('useOfflineUpdateStatus', () => {
  afterEach(() => {
    outdated.mockReset();
  });

  it('does not check and reports no update when offline or cragId is missing', async () => {
    setNavigatorOnLine(false);
    const { result, rerender } = renderHook(
      ({ cragId }: { cragId: string | undefined }) => useOfflineUpdateStatus(cragId),
      { wrapper, initialProps: { cragId: SAMPLE_CRAG_ID as string | undefined } },
    );

    await waitFor(() => {
      expect(result.current.checking).toBe(false);
    });
    expect(result.current.needsUpdate).toBe(false);
    expect(outdated).not.toHaveBeenCalled();

    setNavigatorOnLine(true);
    rerender({ cragId: undefined });
    await waitFor(() => {
      expect(result.current.checking).toBe(false);
    });
    expect(outdated).not.toHaveBeenCalled();
  });

  it('sets needsUpdate from the outdated check and refreshes on pack changes', async () => {
    outdated.mockResolvedValueOnce(true);
    const { result } = renderHook(() => useOfflineUpdateStatus(SAMPLE_CRAG_ID), {
      wrapper,
    });

    await waitFor(() => {
      expect(result.current.needsUpdate).toBe(true);
    });
    expect(result.current.checking).toBe(false);

    outdated.mockResolvedValueOnce(false);
    window.dispatchEvent(new Event('offline-crags-changed'));

    await waitFor(() => {
      expect(result.current.needsUpdate).toBe(false);
    });
    expect(outdated).toHaveBeenCalledTimes(2);
  });

  it('treats a rejected outdated check as up to date', async () => {
    outdated.mockRejectedValueOnce(new Error('compare failed'));
    const { result } = renderHook(() => useOfflineUpdateStatus(SAMPLE_CRAG_ID), {
      wrapper,
    });

    await waitFor(() => {
      expect(result.current.checking).toBe(false);
    });
    expect(result.current.needsUpdate).toBe(false);
  });
});
