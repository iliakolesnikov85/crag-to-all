import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';
import { setAuthAccount, type AuthAccount } from '../auth/session';
import { CragContext } from '../context/CragContext';
import Navigation from './Navigation';

const crag = {
  id: 'roshka',
  cragName: 'Roshka',
  source: 'explorer' as const,
  published: true,
};

function renderNav(): void {
  render(
    <MemoryRouter initialEntries={['/roshka/routes']}>
      <CragContext.Provider
        value={{
          crag,
          getUrl: (url) => `/roshka${url}`,
        }}
      >
        <Navigation />
      </CragContext.Provider>
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

describe('Navigation', () => {
  it('hides the Authors tab from a visitor', () => {
    renderNav();

    expect(screen.queryByRole('link', { name: 'Authors' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Team' })).not.toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'Routes' }).length).toBeGreaterThan(0);
  });

  it('shows the Authors tab for an admin of this crag', () => {
    signIn({ uid: 'admin-user', superadmin: false, roles: { roshka: 'admin' } });
    renderNav();

    const links = screen.getAllByRole('link', { name: 'Authors' });
    expect(links.length).toBeGreaterThan(0);
    expect(links[0]).toHaveAttribute('href', '/roshka/authors');
  });
});
