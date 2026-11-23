import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createAppQueryClient } from '../api/queryClient';
import { setAuthAccount, type AuthAccount } from '../auth/session';
import { CragContext } from '../context/CragContext';
import type { Crag } from '../types';
import AuthorsPage from './AuthorsPage';

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

const explorerCrag: Crag = {
  id: 'roshka',
  cragName: 'Roshka',
  source: 'explorer',
  published: true,
};

function renderPage(crag: Crag = explorerCrag): void {
  const client = createAppQueryClient();
  render(
    <MemoryRouter>
      <QueryClientProvider client={client}>
        <CragContext.Provider
          value={{
            crag,
            getUrl: (url) => `/roshka${url}`,
          }}
        >
          <AuthorsPage />
        </CragContext.Provider>
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

function signIn(account: Pick<AuthAccount, 'uid' | 'superadmin' | 'roles'>): void {
  setAuthAccount({
    email: `${account.uid}@example.com`,
    emailVerified: true,
    getIdToken: async () => 'token',
    ...account,
  });
}

afterEach(() => {
  setAuthAccount(null);
});

describe('AuthorsPage', () => {
  it('shows the membership table for an admin of this crag', async () => {
    signIn({ uid: 'admin-user', superadmin: false, roles: { roshka: 'admin' } });
    renderPage();

    expect(await screen.findByRole('heading', { name: 'Authors' })).toBeInTheDocument();
    expect(await screen.findByText('Ada')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add member' })).not.toBeInTheDocument();
  });

  it('hides the page from a visitor', () => {
    renderPage();

    expect(screen.getByRole('heading', { name: 'Page Not Found' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Authors' })).not.toBeInTheDocument();
  });

  it('hides the page from a member of another crag', () => {
    signIn({ uid: 'other-user', superadmin: false, roles: { other: 'admin' } });
    renderPage();

    expect(screen.getByRole('heading', { name: 'Page Not Found' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Authors' })).not.toBeInTheDocument();
  });
});
