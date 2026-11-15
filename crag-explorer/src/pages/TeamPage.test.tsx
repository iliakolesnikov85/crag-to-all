import { QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { createAppQueryClient } from '../api/queryClient';
import { setAuthAccount } from '../auth/session';
import { CragContext } from '../context/CragContext';
import TeamPage from './TeamPage';

vi.mock('../api/client', async () => {
  const actual = await vi.importActual<typeof import('../api/client')>('../api/client');
  return {
    ...actual,
    listCragMembers: vi.fn(async () => [
      {
        userId: 'admin-1',
        role: 'admin',
        email: 'ada@example.com',
        name: 'Ada',
      },
    ]),
  };
});

const open = vi.spyOn(window, 'open').mockImplementation(() => null);

afterEach(() => {
  open.mockClear();
  setAuthAccount(null);
});

afterAll(() => {
  open.mockRestore();
});

describe('TeamPage', () => {
  it('renders the team blurb and member names', () => {
    render(<TeamPage />);

    expect(screen.getByRole('heading', { name: 'About Roshka Team' })).toBeInTheDocument();
    expect(screen.getByText('George Manukian')).toBeInTheDocument();
    expect(screen.getByText('Ilia Kolesnikov')).toBeInTheDocument();
    expect(screen.getByText('Reclus')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'roshka.climb' }),
    ).toHaveAttribute('href', 'https://www.instagram.com/roshka.climb/');
    expect(screen.queryByRole('heading', { name: 'Authors' })).not.toBeInTheDocument();
  });

  it('shows the membership table for an admin of this crag', async () => {
    setAuthAccount({
      uid: 'admin-user',
      email: 'admin@example.com',
      superadmin: false,
      roles: { roshka: 'admin' },
      getIdToken: async () => 'token',
    });
    const client = createAppQueryClient();
    render(
      <QueryClientProvider client={client}>
        <CragContext.Provider
          value={{
            crag: { cragId: 'roshka', cragName: 'Roshka', source: 'explorer' },
            getUrl: (url) => url,
          }}
        >
          <TeamPage />
        </CragContext.Provider>
      </QueryClientProvider>,
    );

    expect(await screen.findByRole('heading', { name: 'Authors' })).toBeInTheDocument();
    expect(await screen.findByText('Ada')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add member' })).not.toBeInTheDocument();
  });

  it('opens Instagram ahead of Telegram when a card is clicked', () => {
    render(<TeamPage />);

    fireEvent.click(screen.getByText('Reclus').closest('.member-card')!);
    expect(open).toHaveBeenCalledWith(
      'https://www.instagram.com/re.clus',
      '_blank',
      'noopener,noreferrer',
    );

    fireEvent.click(screen.getByText('Ilia Kolesnikov').closest('.member-card')!);
    expect(open).toHaveBeenCalledWith(
      'https://t.me/ikolesnikov',
      '_blank',
      'noopener,noreferrer',
    );

    fireEvent.click(screen.getByText('George Manukian').closest('.member-card')!);
    expect(open).toHaveBeenCalledTimes(2);
  });
});
