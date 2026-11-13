import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthEmulator } from '../../auth/config';
import {
  createAccount,
  sendPasswordReset,
  signInWithEmail,
  signInWithGoogle,
  signOutCurrentUser,
} from '../../auth/firebaseAuth';
import { setAuthAccount, type AuthAccount } from '../../auth/session';
import Header from '../Header';

vi.mock('../../auth/config', () => ({
  useAuthEmulator: vi.fn(() => true),
}));

vi.mock('../../auth/firebaseAuth', () => ({
  createAccount: vi.fn(),
  readIdToken: vi.fn(),
  sendPasswordReset: vi.fn(),
  signInWithEmail: vi.fn(),
  signInWithGoogle: vi.fn(),
  signOutCurrentUser: vi.fn(),
  startAuthListener: vi.fn(),
}));

const ada: AuthAccount = {
  uid: 'ada',
  email: 'ada@example.com',
  superadmin: false,
  roles: null,
  getIdToken: async () => 'token',
};

function renderHeader() {
  return render(
    <MemoryRouter>
      <Header title="Roshka" />
    </MemoryRouter>,
  );
}

function openSignIn(): HTMLElement {
  fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
  return screen.getByRole('dialog', { name: 'Sign in' });
}

describe('AuthControls', () => {
  beforeEach(() => {
    vi.mocked(signInWithEmail).mockReset();
    vi.mocked(signInWithEmail).mockResolvedValue(undefined);
    vi.mocked(createAccount).mockReset();
    vi.mocked(createAccount).mockResolvedValue(undefined);
    vi.mocked(signInWithGoogle).mockReset();
    vi.mocked(signInWithGoogle).mockResolvedValue(undefined);
    vi.mocked(sendPasswordReset).mockReset();
    vi.mocked(sendPasswordReset).mockResolvedValue(undefined);
    vi.mocked(signOutCurrentUser).mockReset();
    vi.mocked(signOutCurrentUser).mockResolvedValue(undefined);
    setAuthAccount(null);
    vi.mocked(useAuthEmulator).mockReturnValue(true);
  });

  it('omits sign-in when the local Auth emulator is off', () => {
    vi.mocked(useAuthEmulator).mockReturnValue(false);
    renderHeader();
    expect(screen.queryByRole('button', { name: 'Sign in' })).not.toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('shows the email after the session changes', () => {
    renderHeader();
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument();
    act(() => {
      setAuthAccount(ada);
    });
    expect(screen.getByText('ada@example.com')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeInTheDocument();
  });

  it('signs in with email and password', async () => {
    vi.mocked(signInWithEmail).mockImplementation(async () => {
      setAuthAccount(ada);
    });
    renderHeader();
    const dialog = openSignIn();
    fireEvent.change(within(dialog).getByLabelText('Email'), {
      target: { value: '  ada@example.com  ' },
    });
    fireEvent.change(within(dialog).getByLabelText('Password'), {
      target: { value: 'secret1' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Sign in' }));

    await waitFor(() => {
      expect(screen.getByText('ada@example.com')).toBeInTheDocument();
    });
    expect(signInWithEmail).toHaveBeenCalledWith('ada@example.com', 'secret1');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('shows the password rule Firebase returned', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const failure = Object.assign(
      new Error('Firebase: Password should be at least 6 characters (auth/weak-password).'),
      { code: 'auth/weak-password' },
    );
    vi.mocked(signInWithEmail).mockRejectedValue(failure);
    renderHeader();
    const dialog = openSignIn();
    fireEvent.change(within(dialog).getByLabelText('Email'), {
      target: { value: 'ada@example.com' },
    });
    fireEvent.change(within(dialog).getByLabelText('Password'), {
      target: { value: 'short' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Sign in' }));

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'Password should be at least 6 characters',
    );
    expect(signInWithEmail).toHaveBeenCalledWith('ada@example.com', 'short');
    expect(error).toHaveBeenCalledWith('Sign-in failed:', failure);
    error.mockRestore();
  });

  it('shows and logs a rejected sign-in', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const failure = Object.assign(new Error('nope'), { code: 'auth/invalid-credential' });
    vi.mocked(signInWithEmail).mockRejectedValue(failure);
    renderHeader();
    const dialog = openSignIn();
    fireEvent.change(within(dialog).getByLabelText('Email'), {
      target: { value: 'ada@example.com' },
    });
    fireEvent.change(within(dialog).getByLabelText('Password'), {
      target: { value: 'secret1' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Sign in' }));

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'That email and password do not match.',
    );
    expect(error).toHaveBeenCalledWith('Sign-in failed:', failure);
    error.mockRestore();
  });

  it('creates an account', async () => {
    renderHeader();
    openSignIn();
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }));
    const dialog = screen.getByRole('dialog', { name: 'Create account' });
    fireEvent.change(within(dialog).getByLabelText('Email'), {
      target: { value: 'ada@example.com' },
    });
    fireEvent.change(within(dialog).getByLabelText('Password'), {
      target: { value: 'secret1' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Create account' }));

    await waitFor(() => {
      expect(createAccount).toHaveBeenCalledWith('ada@example.com', 'secret1');
    });
  });

  it('starts Google sign-in', async () => {
    renderHeader();
    const dialog = openSignIn();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Continue with Google' }));
    await waitFor(() => {
      expect(signInWithGoogle).toHaveBeenCalledTimes(1);
    });
  });

  it('does not show an error when Google sign-in is closed', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const failure = Object.assign(new Error('closed'), { code: 'auth/popup-closed-by-user' });
    vi.mocked(signInWithGoogle).mockRejectedValue(failure);
    renderHeader();
    const dialog = openSignIn();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Continue with Google' }));

    await waitFor(() => {
      expect(warn).toHaveBeenCalledWith(
        'Google sign-in was closed before it finished:',
        failure,
      );
    });
    expect(within(dialog).queryByRole('alert')).not.toBeInTheDocument();
    warn.mockRestore();
  });

  it('sends a password reset and asks the user to check email', async () => {
    renderHeader();
    openSignIn();
    fireEvent.click(screen.getByRole('button', { name: 'Forgot password' }));
    const dialog = screen.getByRole('dialog', { name: 'Reset password' });
    expect(within(dialog).queryByLabelText('Password')).not.toBeInTheDocument();
    fireEvent.change(within(dialog).getByLabelText('Email'), {
      target: { value: 'ada@example.com' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Send reset email' }));

    const status = await within(dialog).findByRole('status');
    expect(status).toHaveTextContent('Check your email for a link to reset your password.');
    expect(within(status).queryByRole('link')).not.toBeInTheDocument();
    expect(sendPasswordReset).toHaveBeenCalledWith('ada@example.com');
  });

  it('does not describe a missing reset account as a bad password', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const failure = Object.assign(new Error('no user'), { code: 'auth/user-not-found' });
    vi.mocked(sendPasswordReset).mockRejectedValue(failure);
    renderHeader();
    openSignIn();
    fireEvent.click(screen.getByRole('button', { name: 'Forgot password' }));
    const dialog = screen.getByRole('dialog', { name: 'Reset password' });
    fireEvent.change(within(dialog).getByLabelText('Email'), {
      target: { value: 'ada@example.com' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Send reset email' }));

    const alert = await within(dialog).findByRole('alert');
    expect(alert).toHaveTextContent('No account uses that email.');
    expect(alert).not.toHaveTextContent('do not match');
    expect(error).toHaveBeenCalledWith('Password reset failed:', failure);
    error.mockRestore();
  });

  it('signs out', async () => {
    setAuthAccount(ada);
    vi.mocked(signOutCurrentUser).mockImplementation(async () => {
      setAuthAccount(null);
    });
    renderHeader();
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument();
    });
    expect(signOutCurrentUser).toHaveBeenCalledTimes(1);
  });

  it('logs a failed sign-out', async () => {
    setAuthAccount(ada);
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const failure = new Error('still here');
    vi.mocked(signOutCurrentUser).mockRejectedValue(failure);
    renderHeader();
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not sign out. Try again.');
    expect(error).toHaveBeenCalledWith('Sign-out failed:', failure);
    expect(screen.getByText('ada@example.com')).toBeInTheDocument();
    error.mockRestore();
  });
});
