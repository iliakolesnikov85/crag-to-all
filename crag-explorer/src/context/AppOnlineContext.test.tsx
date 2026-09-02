import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { setNavigatorOnLine } from '../test/helpers';
import {
  AppOnlineProvider,
  useAppOnline,
} from './AppOnlineContext';

function Probe() {
  const { isOnline, markNetworkLimited, markNetworkOk } = useAppOnline();
  return (
    <div>
      <span data-testid="online">{String(isOnline)}</span>
      <button type="button" onClick={markNetworkLimited}>
        limit
      </button>
      <button type="button" onClick={markNetworkOk}>
        ok
      </button>
    </div>
  );
}

describe('AppOnlineContext', () => {
  it('throws when useAppOnline is used without a provider', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Probe />)).toThrow(
      'useAppOnline must be used within AppOnlineProvider',
    );
    error.mockRestore();
  });

  it('is online by default and goes limited after markNetworkLimited', () => {
    render(
      <AppOnlineProvider>
        <Probe />
      </AppOnlineProvider>,
    );

    expect(screen.getByTestId('online')).toHaveTextContent('true');
    fireEvent.click(screen.getByRole('button', { name: 'limit' }));
    expect(screen.getByTestId('online')).toHaveTextContent('false');
    fireEvent.click(screen.getByRole('button', { name: 'ok' }));
    expect(screen.getByTestId('online')).toHaveTextContent('true');
  });

  it('clears the limited flag when the browser comes back online', () => {
    render(
      <AppOnlineProvider>
        <Probe />
      </AppOnlineProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'limit' }));
    expect(screen.getByTestId('online')).toHaveTextContent('false');

    act(() => {
      setNavigatorOnLine(false);
      window.dispatchEvent(new Event('offline'));
    });
    expect(screen.getByTestId('online')).toHaveTextContent('false');

    act(() => {
      setNavigatorOnLine(true);
      window.dispatchEvent(new Event('online'));
    });
    expect(screen.getByTestId('online')).toHaveTextContent('true');
  });
});
