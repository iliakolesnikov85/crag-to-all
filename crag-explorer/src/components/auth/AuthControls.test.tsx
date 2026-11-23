import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { isAuthEnabled } from '../../auth/config';
import {
  createAccount,
  sendPasswordReset,
  signInWithEmail,
  signInWithFacebook,
  signInWithGoogle,
  signOutCurrentUser,
} from '../../auth/firebaseAuth';
import { setAuthAccount, type AuthAccount } from '../../auth/session';
import Header from '../Header';

vi.mock('../../auth/config', () => ({
  isAuthEnabled: vi.fn(() => true),
}));

vi.mock('../../auth/firebaseAuth', () => ({
  createAccount: vi.fn(),
  readIdToken: vi.fn(),
  refreshEmailVerified: vi.fn(),
  sendPasswordReset: vi.fn(),
  sendVerificationEmail: vi.fn(),
  updateDisplayName: vi.fn(),
  signInWithEmail: vi.fn(),
  signInWithFacebook: vi.fn(),
  signInWithGoogle: vi.fn(),
  signOutCurrentUser: vi.fn(),
  startAuthListener: vi.fn(),
}));

const ada: AuthAccount = {
  uid: 'ada',
  email: 'ada@example.com',
  emailVerified: true,
  superadmin: false,
  roles: null,
  getIdToken: async () => 'token',
};

function renderHeader() {
  return render(
    <MemoryRouter>
      <Header />
    </MemoryRouter>,
  );
}

function openSignIn(): HTMLElement {
  fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
  return screen.getByRole('dialog', { name: 'Sign in' });
}

/** `Window.closed` is read-only, so tests flip a getter instead. */
function fakeSignInWindow(): { popup: Window; close: () => void } {
  let closed = false;
  const popup = {} as Window;
  Object.defineProperty(popup, 'closed', {
    configurable: true,
    get: () => closed,
  });
  return {
    popup,
    close: () => {
      closed = true;
    },
  };
}

describe('AuthControls', () => {
  beforeEach(() => {
    vi.mocked(signInWithEmail).mockReset();
    vi.mocked(signInWithEmail).mockResolvedValue(undefined);
    vi.mocked(createAccount).mockReset();
    vi.mocked(createAccount).mockResolvedValue(undefined);
    vi.mocked(signInWithGoogle).mockReset();
    vi.mocked(signInWithGoogle).mockResolvedValue(undefined);
    vi.mocked(signInWithFacebook).mockReset();
    vi.mocked(signInWithFacebook).mockResolvedValue(undefined);
    vi.mocked(sendPasswordReset).mockReset();
    vi.mocked(sendPasswordReset).mockResolvedValue(undefined);
    vi.mocked(signOutCurrentUser).mockReset();
    vi.mocked(signOutCurrentUser).mockResolvedValue(undefined);
    setAuthAccount(null);
    vi.mocked(isAuthEnabled).mockReturnValue(true);
  });

  it('omits sign-in when auth is not configured', () => {
    vi.mocked(isAuthEnabled).mockReturnValue(false);
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
    expect(screen.queryByRole('button', { name: 'Sign out' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Send verification email' })).not.toBeInTheDocument();
  });

  it('signs in with email and password', async () => {
    vi.mocked(signInWithEmail).mockImplementation(async () => {
      setAuthAccount(ada);
    });
    renderHeader();
    const dialog = openSignIn();
    expect(within(dialog).queryByLabelText('Display name (optional)')).not.toBeInTheDocument();
    expect(within(dialog).queryByLabelText('Confirm password')).not.toBeInTheDocument();
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

  it('explains when the email already uses another sign-in method', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const failure = Object.assign(new Error('exists'), {
      code: 'auth/account-exists-with-different-credential',
    });
    vi.mocked(signInWithGoogle).mockRejectedValue(failure);
    renderHeader();
    const dialog = openSignIn();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Continue with Google' }));

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'An account already uses that email with a different sign-in method.',
    );
    expect(error).toHaveBeenCalledWith('Google sign-in failed:', failure);
    error.mockRestore();
  });

  it('creates an account', async () => {
    renderHeader();
    openSignIn();
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }));
    const dialog = screen.getByRole('dialog', { name: 'Create account' });
    expect(within(dialog).getByText('We email you a link to verify this account.')).toBeInTheDocument();
    fireEvent.change(within(dialog).getByLabelText('Email'), {
      target: { value: 'ada@example.com' },
    });
    fireEvent.change(within(dialog).getByLabelText('Display name (optional)'), {
      target: { value: '  Ada  ' },
    });
    fireEvent.change(within(dialog).getByLabelText('Password'), {
      target: { value: 'secret1' },
    });
    fireEvent.change(within(dialog).getByLabelText('Confirm password'), {
      target: { value: 'secret1' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Create account' }));

    await waitFor(() => {
      expect(createAccount).toHaveBeenCalledWith('ada@example.com', 'secret1', 'Ada');
    });
  });

  it('asks again when the confirmation does not match', async () => {
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
    fireEvent.change(within(dialog).getByLabelText('Confirm password'), {
      target: { value: 'secret2' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Create account' }));

    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Passwords do not match.');
    expect(createAccount).not.toHaveBeenCalled();
  });

  it('creates an account without a display name', async () => {
    renderHeader();
    openSignIn();
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }));
    const dialog = screen.getByRole('dialog', { name: 'Create account' });
    expect(within(dialog).queryByLabelText('Display name (optional)')).toBeInTheDocument();
    fireEvent.change(within(dialog).getByLabelText('Email'), {
      target: { value: 'ada@example.com' },
    });
    fireEvent.change(within(dialog).getByLabelText('Password'), {
      target: { value: 'secret1' },
    });
    fireEvent.change(within(dialog).getByLabelText('Confirm password'), {
      target: { value: 'secret1' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Create account' }));

    await waitFor(() => {
      expect(createAccount).toHaveBeenCalledWith('ada@example.com', 'secret1', '');
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

  it('hides Facebook sign-in until the Facebook app is ready', () => {
    renderHeader();
    const dialog = openSignIn();
    expect(
      within(dialog).queryByRole('button', { name: 'Continue with Facebook' }),
    ).not.toBeInTheDocument();
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
    await waitFor(() => {
      expect(within(dialog).getByRole('button', { name: 'Continue with Google' })).toBeEnabled();
    });
    warn.mockRestore();
  });

  it('unlocks the dialog when the Google window closes', async () => {
    const { popup, close } = fakeSignInWindow();
    const originalOpen = window.open;
    const open = vi.fn(() => popup);
    window.open = open as typeof window.open;
    vi.mocked(signInWithGoogle).mockImplementation(() => {
      window.open('http://127.0.0.1:9099/emulator/auth/handler', 'auth');
      return new Promise(() => undefined);
    });
    try {
      renderHeader();
      const dialog = openSignIn();
      fireEvent.click(within(dialog).getByRole('button', { name: 'Continue with Google' }));
      await waitFor(() => {
        expect(open).toHaveBeenCalled();
      });
      expect(within(dialog).getByRole('button', { name: 'Please wait...' })).toBeDisabled();
      close();
      await waitFor(() => {
        expect(within(dialog).getByRole('button', { name: 'Sign in' })).toBeEnabled();
      });
      expect(within(dialog).getByRole('button', { name: 'Continue with Google' })).toBeEnabled();
      expect(within(dialog).queryByRole('alert')).not.toBeInTheDocument();
    } finally {
      window.open = originalOpen;
    }
  });

  it('shows a real Google error after the window has closed', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { popup, close } = fakeSignInWindow();
    const originalOpen = window.open;
    const open = vi.fn(() => popup);
    window.open = open as typeof window.open;
    let rejectSignIn: (error: unknown) => void = () => undefined;
    vi.mocked(signInWithGoogle).mockImplementation(
      () => new Promise((_resolve, reject) => {
        window.open('http://127.0.0.1:9099/emulator/auth/handler', 'auth');
        rejectSignIn = reject;
      }),
    );
    try {
      renderHeader();
      const dialog = openSignIn();
      fireEvent.click(within(dialog).getByRole('button', { name: 'Continue with Google' }));
      await waitFor(() => {
        expect(open).toHaveBeenCalled();
      });
      close();
      await waitFor(() => {
        expect(within(dialog).getByRole('button', { name: 'Sign in' })).toBeEnabled();
      });
      const failure = Object.assign(new Error('offline'), { code: 'auth/network-request-failed' });
      await act(async () => {
        rejectSignIn(failure);
      });
      expect(await within(dialog).findByRole('alert')).toHaveTextContent(
        'A network error occurred. Check your connection and try again.',
      );
    } finally {
      errorSpy.mockRestore();
      window.open = originalOpen;
    }
  });

  it('drops a late Google error after the user leaves the sign-in form', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { popup, close } = fakeSignInWindow();
    const originalOpen = window.open;
    const open = vi.fn(() => popup);
    window.open = open as typeof window.open;
    let rejectSignIn: (error: unknown) => void = () => undefined;
    vi.mocked(signInWithGoogle).mockImplementation(
      () => new Promise((_resolve, reject) => {
        window.open('http://127.0.0.1:9099/emulator/auth/handler', 'auth');
        rejectSignIn = reject;
      }),
    );
    try {
      renderHeader();
      const dialog = openSignIn();
      fireEvent.click(within(dialog).getByRole('button', { name: 'Continue with Google' }));
      await waitFor(() => {
        expect(open).toHaveBeenCalled();
      });
      close();
      await waitFor(() => {
        expect(within(dialog).getByRole('button', { name: 'Sign in' })).toBeEnabled();
      });
      fireEvent.click(within(dialog).getByRole('button', { name: 'Forgot password' }));
      const resetDialog = screen.getByRole('dialog', { name: 'Reset password' });
      const failure = Object.assign(new Error('offline'), { code: 'auth/network-request-failed' });
      await act(async () => {
        rejectSignIn(failure);
      });
      expect(within(resetDialog).queryByRole('alert')).not.toBeInTheDocument();
      expect(errorSpy).toHaveBeenCalledWith(
        'Google sign-in failed after the form moved on:',
        failure,
      );
    } finally {
      errorSpy.mockRestore();
      window.open = originalOpen;
    }
  });

  it('drops a late Google error after the user starts email sign-in', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { popup, close } = fakeSignInWindow();
    const originalOpen = window.open;
    const open = vi.fn(() => popup);
    window.open = open as typeof window.open;
    let rejectSignIn: (error: unknown) => void = () => undefined;
    vi.mocked(signInWithGoogle).mockImplementation(
      () => new Promise((_resolve, reject) => {
        window.open('http://127.0.0.1:9099/emulator/auth/handler', 'auth');
        rejectSignIn = reject;
      }),
    );
    let resolveEmail: () => void = () => undefined;
    vi.mocked(signInWithEmail).mockImplementation(
      () => new Promise((resolve) => {
        resolveEmail = resolve;
      }),
    );
    try {
      renderHeader();
      const dialog = openSignIn();
      fireEvent.click(within(dialog).getByRole('button', { name: 'Continue with Google' }));
      await waitFor(() => {
        expect(open).toHaveBeenCalled();
      });
      close();
      await waitFor(() => {
        expect(within(dialog).getByRole('button', { name: 'Sign in' })).toBeEnabled();
      });
      fireEvent.change(within(dialog).getByLabelText('Email'), {
        target: { value: 'ada@example.com' },
      });
      fireEvent.change(within(dialog).getByLabelText('Password'), {
        target: { value: 'secret1' },
      });
      fireEvent.click(within(dialog).getByRole('button', { name: 'Sign in' }));
      await waitFor(() => {
        expect(signInWithEmail).toHaveBeenCalledWith('ada@example.com', 'secret1');
      });
      const failure = Object.assign(new Error('offline'), { code: 'auth/network-request-failed' });
      await act(async () => {
        rejectSignIn(failure);
      });
      expect(within(dialog).queryByRole('alert')).not.toBeInTheDocument();
      expect(within(dialog).getByRole('button', { name: 'Please wait...' })).toBeDisabled();
      expect(errorSpy).toHaveBeenCalledWith(
        'Google sign-in failed after the form moved on:',
        failure,
      );
      await act(async () => {
        resolveEmail();
      });
    } finally {
      errorSpy.mockRestore();
      window.open = originalOpen;
    }
  });

  it('drops a late Google error after the user sends a password reset', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { popup, close } = fakeSignInWindow();
    const originalOpen = window.open;
    const open = vi.fn(() => popup);
    window.open = open as typeof window.open;
    let rejectSignIn: (error: unknown) => void = () => undefined;
    vi.mocked(signInWithGoogle).mockImplementation(
      () => new Promise((_resolve, reject) => {
        window.open('http://127.0.0.1:9099/emulator/auth/handler', 'auth');
        rejectSignIn = reject;
      }),
    );
    try {
      renderHeader();
      const dialog = openSignIn();
      fireEvent.click(within(dialog).getByRole('button', { name: 'Continue with Google' }));
      await waitFor(() => {
        expect(open).toHaveBeenCalled();
      });
      close();
      await waitFor(() => {
        expect(within(dialog).getByRole('button', { name: 'Sign in' })).toBeEnabled();
      });
      fireEvent.click(within(dialog).getByRole('button', { name: 'Forgot password' }));
      const resetDialog = screen.getByRole('dialog', { name: 'Reset password' });
      fireEvent.change(within(resetDialog).getByLabelText('Email'), {
        target: { value: 'ada@example.com' },
      });
      fireEvent.click(within(resetDialog).getByRole('button', { name: 'Send reset email' }));
      expect(await within(resetDialog).findByRole('status')).toHaveTextContent(
        'Check your email for a link to reset your password.',
      );
      const failure = Object.assign(new Error('offline'), { code: 'auth/network-request-failed' });
      await act(async () => {
        rejectSignIn(failure);
      });
      expect(within(resetDialog).queryByRole('alert')).not.toBeInTheDocument();
      expect(within(resetDialog).getByRole('status')).toHaveTextContent(
        'Check your email for a link to reset your password.',
      );
      expect(errorSpy).toHaveBeenCalledWith(
        'Google sign-in failed after the form moved on:',
        failure,
      );
    } finally {
      errorSpy.mockRestore();
      window.open = originalOpen;
    }
  });

  it('keeps the form locked when the sign-in window cannot be read', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const popup = {} as Window;
    Object.defineProperty(popup, 'closed', {
      get() {
        throw new Error('blocked');
      },
    });
    const originalOpen = window.open;
    const open = vi.fn(() => popup);
    window.open = open as typeof window.open;
    vi.mocked(signInWithGoogle).mockImplementation(() => {
      window.open('http://127.0.0.1:9099/emulator/auth/handler', 'auth');
      return new Promise(() => undefined);
    });
    try {
      renderHeader();
      const dialog = openSignIn();
      fireEvent.click(within(dialog).getByRole('button', { name: 'Continue with Google' }));
      await waitFor(() => {
        expect(warn).toHaveBeenCalledWith(
          'Could not read the sign-in window:',
          expect.any(Error),
        );
      });
      expect(within(dialog).getByRole('button', { name: 'Please wait...' })).toBeDisabled();
      expect(warn).toHaveBeenCalledTimes(1);
    } finally {
      warn.mockRestore();
      window.open = originalOpen;
    }
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

  it('asks the user to check email when the reset account is missing', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
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

    const status = await within(dialog).findByRole('status');
    expect(status).toHaveTextContent('Check your email for a link to reset your password.');
    expect(within(dialog).queryByRole('alert')).not.toBeInTheDocument();
    expect(warn).toHaveBeenCalledWith(
      'Password reset found no account. The form still asks the user to check email:',
      failure,
    );
    expect(error).not.toHaveBeenCalled();
    warn.mockRestore();
    error.mockRestore();
  });

  it('does not open the sign-in dialog again after sign-out', async () => {
    renderHeader();
    openSignIn();
    act(() => {
      setAuthAccount(ada);
    });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    vi.mocked(signOutCurrentUser).mockImplementation(async () => {
      setAuthAccount(null);
    });
    fireEvent.click(screen.getByRole('button', { name: 'Menu' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Sign out' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument();
    });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
