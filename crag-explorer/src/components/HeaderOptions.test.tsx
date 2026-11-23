import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  refreshEmailVerified,
  sendPasswordReset,
  sendVerificationEmail,
  signOutCurrentUser,
  updateDisplayName,
} from '../auth/firebaseAuth';
import { setAuthAccount, type AuthAccount } from '../auth/session';
import { signInTestUser } from '../test/authAccount';
import { withQueryClient } from '../test/helpers';
import Header from './Header';

vi.mock('../auth/firebaseAuth', () => ({
  refreshEmailVerified: vi.fn(),
  sendPasswordReset: vi.fn(),
  sendVerificationEmail: vi.fn(),
  signOutCurrentUser: vi.fn(),
  startAuthListener: vi.fn(),
  updateDisplayName: vi.fn(),
}));

function LocationProbe() {
  const { pathname } = useLocation();
  return <div data-testid="location">{pathname}</div>;
}

function renderHeader() {
  return render(
    withQueryClient(
      <MemoryRouter>
        <Header />
        <LocationProbe />
      </MemoryRouter>,
    ),
  );
}

const visitor: AuthAccount = {
  uid: 'visitor',
  email: 'testver@test1.ru',
  displayName: 'Vera',
  emailVerified: false,
  superadmin: false,
  roles: {},
  getIdToken: async () => 'token',
};

function openProfile(): HTMLElement {
  fireEvent.click(screen.getByRole('button', { name: 'Menu' }));
  fireEvent.click(screen.getByRole('menuitem', { name: 'Profile Settings' }));
  return screen.getByRole('dialog', { name: 'Profile' });
}

describe('HeaderOptions', () => {
  beforeEach(() => {
    vi.mocked(updateDisplayName).mockReset();
    vi.mocked(updateDisplayName).mockResolvedValue(undefined);
    vi.mocked(sendVerificationEmail).mockReset();
    vi.mocked(sendVerificationEmail).mockResolvedValue(undefined);
    vi.mocked(sendPasswordReset).mockReset();
    vi.mocked(sendPasswordReset).mockResolvedValue(undefined);
    vi.mocked(refreshEmailVerified).mockReset();
    vi.mocked(refreshEmailVerified).mockResolvedValue(undefined);
    vi.mocked(signOutCurrentUser).mockReset();
    vi.mocked(signOutCurrentUser).mockResolvedValue(undefined);
    setAuthAccount(null);
  });

  it('opens crag management for a superadmin', () => {
    signInTestUser();
    renderHeader();

    fireEvent.click(screen.getByRole('button', { name: 'Menu' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Manage Crags' }));

    expect(screen.getByTestId('location')).toHaveTextContent('/crag-manage');
  });

  it('hides the menu when signed out', () => {
    renderHeader();

    expect(screen.queryByRole('button', { name: 'Menu' })).not.toBeInTheDocument();
  });

  it('puts Sign out at the bottom with a separator above it', () => {
    setAuthAccount(visitor);
    renderHeader();

    fireEvent.click(screen.getByRole('button', { name: 'Menu' }));
    const menu = screen.getByRole('menu');
    const items = within(menu).getAllByRole('menuitem');
    expect(items.map((item) => item.textContent)).toEqual(['Profile Settings', 'Sign out']);
    expect(within(menu).getByRole('separator')).toBeInTheDocument();
  });

  it('signs out from the menu', async () => {
    setAuthAccount(visitor);
    vi.mocked(signOutCurrentUser).mockImplementation(async () => {
      setAuthAccount(null);
    });
    renderHeader();

    fireEvent.click(screen.getByRole('button', { name: 'Menu' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Sign out' }));

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Menu' })).not.toBeInTheDocument();
    });
    expect(signOutCurrentUser).toHaveBeenCalledTimes(1);
  });

  it('explains when sign-out fails', async () => {
    setAuthAccount(visitor);
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const failure = new Error('still here');
    vi.mocked(signOutCurrentUser).mockRejectedValue(failure);
    renderHeader();

    fireEvent.click(screen.getByRole('button', { name: 'Menu' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Sign out' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not sign out. Try again.');
    expect(error).toHaveBeenCalledWith('Sign-out failed:', failure);
    error.mockRestore();
  });

  it('opens the profile dialog from the menu', () => {
    setAuthAccount(visitor);
    renderHeader();

    fireEvent.click(screen.getByRole('button', { name: 'Menu' }));
    expect(screen.queryByRole('menuitem', { name: 'Manage Crags' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Profile Settings' }));

    const dialog = screen.getByRole('dialog', { name: 'Profile' });
    expect(within(dialog).getByLabelText('Name')).toHaveValue('Vera');
    expect(within(dialog).getByText('testver@test1.ru')).toBeInTheDocument();
    expect(within(dialog).getByText('This email is not verified yet.')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Send verification email' })).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Reset password' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Send verification email' })).toBe(
      within(dialog).getByRole('button', { name: 'Send verification email' }),
    );
  });

  it('saves the name, sends verification, and sends a password reset', async () => {
    setAuthAccount(visitor);
    renderHeader();
    const dialog = openProfile();

    fireEvent.change(within(dialog).getByLabelText('Name'), { target: { value: '  Ada  ' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save name' }));
    await waitFor(() => {
      expect(updateDisplayName).toHaveBeenCalledWith('  Ada  ');
    });
    expect(await within(dialog).findByText('Name saved.')).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Send verification email' }));
    const sent = await within(dialog).findByText(
      'Verification email sent. Check your inbox and spam folder.',
    );
    expect(sent).toHaveAttribute('role', 'status');
    expect(sendVerificationEmail).toHaveBeenCalledTimes(1);

    fireEvent.click(within(dialog).getByRole('button', { name: 'Reset password' }));
    expect(await within(dialog).findByText(
      'Check your email for a link to reset your password.',
    )).toBeInTheDocument();
    expect(sendPasswordReset).toHaveBeenCalledWith('testver@test1.ru');
  });

  it('keeps Profile closed after the next sign-in', async () => {
    setAuthAccount(visitor);
    renderHeader();
    openProfile();

    setAuthAccount(null);
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Profile' })).not.toBeInTheDocument();
    });

    setAuthAccount(visitor);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Menu' })).toBeInTheDocument();
    });
    expect(screen.queryByRole('dialog', { name: 'Profile' })).not.toBeInTheDocument();
  });

  it('shows a verified email without the send button', () => {
    setAuthAccount({ ...visitor, emailVerified: true });
    renderHeader();
    const dialog = openProfile();

    expect(within(dialog).getByText('This email is verified.')).toBeInTheDocument();
    expect(within(dialog).queryByRole('button', { name: 'Send verification email' })).not.toBeInTheDocument();
    expect(refreshEmailVerified).not.toHaveBeenCalled();
  });

  it('refreshes an unverified email and shows it when verification arrives', async () => {
    setAuthAccount(visitor);
    renderHeader();
    const dialog = openProfile();

    expect(refreshEmailVerified).toHaveBeenCalledTimes(1);
    fireEvent(window, new Event('focus'));
    expect(refreshEmailVerified).toHaveBeenCalledTimes(2);

    setAuthAccount({ ...visitor, emailVerified: true });
    expect(await within(dialog).findByText('This email is verified.')).toBeInTheDocument();
    expect(within(dialog).queryByRole('button', { name: 'Send verification email' })).not.toBeInTheDocument();

    fireEvent(window, new Event('focus'));
    expect(refreshEmailVerified).toHaveBeenCalledTimes(2);
  });

  it('explains when the name cannot be saved', async () => {
    setAuthAccount(visitor);
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const failure = Object.assign(new Error('stale login'), { code: 'auth/requires-recent-login' });
    vi.mocked(updateDisplayName).mockRejectedValue(failure);
    renderHeader();
    const dialog = openProfile();

    fireEvent.change(within(dialog).getByLabelText('Name'), { target: { value: 'Ada' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save name' }));

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'Sign in again, then try once more.',
    );
    expect(error).toHaveBeenCalledWith('Failed to save the profile name:', failure);
    error.mockRestore();
  });

  it('explains when the password reset is refused', async () => {
    setAuthAccount(visitor);
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const failure = Object.assign(new Error('offline'), { code: 'auth/network-request-failed' });
    vi.mocked(sendPasswordReset).mockRejectedValue(failure);
    renderHeader();
    const dialog = openProfile();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Reset password' }));

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'A network error occurred. Check your connection and try again.',
    );
    expect(error).toHaveBeenCalledWith('Failed to send the password reset:', failure);
    error.mockRestore();
  });

  it('explains when the verification email is refused', async () => {
    setAuthAccount(visitor);
    const error = vi.spyOn(console, 'error').mockImplementation(() => { });
    const failure = Object.assign(new Error('slow down'), { code: 'auth/too-many-requests' });
    vi.mocked(sendVerificationEmail).mockRejectedValue(failure);
    renderHeader();
    const dialog = openProfile();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Send verification email' }));

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'Too many emails were sent. Wait a few minutes and try again.',
    );
    expect(error).toHaveBeenCalledWith('Failed to send the verification email:', failure);
    error.mockRestore();
  });
});
