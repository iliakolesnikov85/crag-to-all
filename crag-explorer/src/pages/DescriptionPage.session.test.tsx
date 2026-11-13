import { act, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { setAuthAccount, type AuthAccount } from '../auth/session';
import { CragContext } from '../context/CragContext';
import { signInTestUser } from '../test/authAccount';
import { withQueryClient } from '../test/helpers';
import DescriptionPage from './DescriptionPage';

const explorerCrag = {
  crag: { cragId: 'roshka', cragName: 'Roshka', source: 'explorer' as const },
  getUrl: (url: string) => url,
};

const description = [{ subheader: 'Access', paragraphs: ['Walk in'] }];

function renderPage(source: 'explorer' | 'external' = 'explorer') {
  const value = source === 'explorer'
    ? explorerCrag
    : {
      ...explorerCrag,
      crag: { ...explorerCrag.crag, source: 'external' as const },
    };
  return render(
    withQueryClient(
      <CragContext.Provider value={value}>
        <DescriptionPage description={description} version={1} />
      </CragContext.Provider>,
    ),
  );
}

function signIn(account: AuthAccount): void {
  act(() => {
    setAuthAccount(account);
  });
}

describe('DescriptionPage session', () => {
  it('shows edit controls for a superadmin', () => {
    setAuthAccount(null);
    renderPage();
    expect(screen.queryByRole('button', { name: 'Add section' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit Access' })).not.toBeInTheDocument();

    act(() => {
      signInTestUser();
    });

    expect(screen.getByRole('button', { name: 'Add section' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Edit Access' })).toBeInTheDocument();
  });

  it('hides edit controls for a signed-in user with no role', () => {
    signIn({
      uid: 'visitor',
      email: 'visitor@example.com',
      superadmin: false,
      roles: {},
      getIdToken: async () => 'token',
    });
    renderPage();
    expect(screen.queryByRole('button', { name: 'Add section' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit Access' })).not.toBeInTheDocument();
  });

  it('shows edit controls for an admin of this crag', () => {
    signIn({
      uid: 'admin-user',
      email: 'admin@example.com',
      superadmin: false,
      roles: { roshka: 'admin' },
      getIdToken: async () => 'token',
    });
    renderPage();
    expect(screen.getByRole('button', { name: 'Add section' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Edit Access' })).toBeInTheDocument();
  });

  it('keeps an extracted crag read-only after sign-in', () => {
    signInTestUser();
    renderPage('external');
    expect(screen.queryByRole('button', { name: 'Add section' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Access' })).toBeInTheDocument();
  });
});
