import { useId, useState, type FormEvent } from 'react';
import {
  createAccount,
  sendPasswordReset,
  signInWithEmail,
  signInWithGoogle,
} from '../../auth/firebaseAuth';
import Button from '../Button';
import Modal from '../Modal';
import './AuthDialog.scss';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type AuthMode = 'sign-in' | 'create' | 'reset';

interface AuthDialogProps {
  onClose: () => void;
}

function firebaseErrorCode(error: unknown): string {
  if (!error || typeof error !== 'object' || !('code' in error)) return '';
  const code = (error as { code: unknown }).code;
  return typeof code === 'string' ? code : '';
}

function isDismissedSignIn(error: unknown): boolean {
  const code = firebaseErrorCode(error);
  return code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request';
}

/** Firebase wraps the server sentence as `Firebase: … (auth/code).`. */
function firebasePasswordMessage(error: unknown): string | null {
  if (!(error instanceof Error)) return null;
  const text = error.message
    .replace(/^Firebase:\s*/i, '')
    .replace(/\s*\(auth\/[a-z0-9-]+\)\.?$/i, '')
    .trim();
  if (!text || text.toLowerCase() === 'error') return null;
  return text;
}

function isUnknownResetAccount(code: string): boolean {
  return code === 'auth/user-not-found'
    || code === 'auth/invalid-credential'
    || code === 'auth/invalid-login-credentials'
    || code === 'auth/wrong-password';
}

function authFailureMessage(error: unknown, mode: AuthMode, fallback: string): string {
  const code = firebaseErrorCode(error);
  if (mode === 'reset' && isUnknownResetAccount(code)) {
    return 'No account uses that email.';
  }
  switch (code) {
    case 'auth/invalid-email':
      return 'Enter a valid email address.';
    case 'auth/missing-password':
    case 'auth/weak-password':
    case 'auth/password-does-not-meet-requirements':
      return firebasePasswordMessage(error) ?? 'That password was rejected. Try another one.';
    case 'auth/email-already-in-use':
      return 'An account with that email already exists. Sign in instead.';
    case 'auth/invalid-credential':
    case 'auth/invalid-login-credentials':
    case 'auth/user-not-found':
    case 'auth/wrong-password':
      return 'That email and password do not match.';
    case 'auth/popup-blocked':
      return 'The browser blocked the Google sign-in window. Allow popups and try again.';
    case 'auth/network-request-failed':
      return 'A network error occurred. Check your connection and try again.';
    case 'auth/operation-not-allowed':
      return 'This sign-in method is not available.';
    default:
      return fallback;
  }
}

function AuthDialog({ onClose }: AuthDialogProps) {
  const emailId = useId();
  const passwordId = useId();
  const [mode, setMode] = useState<AuthMode>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [resetSent, setResetSent] = useState(false);
  const [busy, setBusy] = useState(false);

  const title = mode === 'create' ? 'Create account' : mode === 'reset' ? 'Reset password' : 'Sign in';
  const submitLabel = busy
    ? 'Please wait...'
    : mode === 'create'
      ? 'Create account'
      : mode === 'reset'
        ? 'Send reset email'
        : 'Sign in';

  const close = () => {
    if (busy) return;
    onClose();
  };

  const choose = (next: AuthMode) => {
    if (busy) return;
    setMode(next);
    setError(null);
    setResetSent(false);
  };

  const fail = (errorValue: unknown, action: string, fallback: string) => {
    if (isDismissedSignIn(errorValue)) {
      console.warn(`${action} was closed before it finished:`, errorValue);
      return;
    }
    console.error(`${action} failed:`, errorValue);
    setError(authFailureMessage(errorValue, mode, fallback));
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    setError(null);
    setResetSent(false);
    const trimmedEmail = email.trim();
    if (!EMAIL_PATTERN.test(trimmedEmail)) {
      setError('Enter a valid email address.');
      return;
    }

    setBusy(true);
    try {
      if (mode === 'reset') {
        await sendPasswordReset(trimmedEmail);
        setResetSent(true);
        return;
      }
      if (mode === 'create') {
        await createAccount(trimmedEmail, password);
        return;
      }
      await signInWithEmail(trimmedEmail, password);
    } catch (errorValue) {
      const action = mode === 'reset'
        ? 'Password reset'
        : mode === 'create'
          ? 'Create account'
          : 'Sign-in';
      const fallback = mode === 'reset'
        ? 'Could not start a password reset. Try again.'
        : mode === 'create'
          ? 'Could not create the account. Try again.'
          : 'Could not sign in. Try again.';
      fail(errorValue, action, fallback);
    } finally {
      setBusy(false);
    }
  };

  const google = async () => {
    if (busy) return;
    setError(null);
    setResetSent(false);
    setBusy(true);
    try {
      await signInWithGoogle();
    } catch (errorValue) {
      fail(errorValue, 'Google sign-in', 'Google sign-in failed. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      compact
      title={title}
      closeOnBackdrop={!busy}
      onClose={close}
    >
      <form className="auth-form" onSubmit={(event) => void submit(event)} noValidate>
        {error ? (
          <p className="auth-form__error" role="alert">
            {error}
          </p>
        ) : null}
        {resetSent ? (
          <p className="auth-form__notice" role="status">
            Check your email for a link to reset your password.
          </p>
        ) : null}
        <label className="auth-form__field" htmlFor={emailId}>
          <span className="auth-form__label">Email</span>
          <input
            id={emailId}
            className="auth-form__input"
            type="email"
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            value={email}
            disabled={busy}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>
        {mode === 'reset' ? null : (
          <label className="auth-form__field" htmlFor={passwordId}>
            <span className="auth-form__label">Password</span>
            <input
              id={passwordId}
              className="auth-form__input"
              type="password"
              autoComplete={mode === 'create' ? 'new-password' : 'current-password'}
              value={password}
              disabled={busy}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
        )}
        <Button type="submit" fullWidth disabled={busy}>
          {submitLabel}
        </Button>
        {mode === 'reset' ? null : (
          <Button type="button" variant="secondary" fullWidth disabled={busy} onClick={() => void google()}>
            Continue with Google
          </Button>
        )}
        <div className="auth-form__switch">
          {mode === 'sign-in' ? null : (
            <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => choose('sign-in')}>
              Sign in
            </Button>
          )}
          {mode === 'create' ? null : (
            <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => choose('create')}>
              Create account
            </Button>
          )}
          {mode === 'reset' ? null : (
            <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => choose('reset')}>
              Forgot password
            </Button>
          )}
        </div>
      </form>
    </Modal>
  );
}

export default AuthDialog;
