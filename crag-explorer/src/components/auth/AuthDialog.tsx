import { useId, useRef, useState, type FormEvent } from 'react';
import { FaFacebook } from 'react-icons/fa';
import { FcGoogle } from 'react-icons/fc';
import { MdLockReset, MdLogin, MdPersonAdd } from 'react-icons/md';
import {
  createAccount,
  sendPasswordReset,
  signInWithEmail,
  signInWithFacebook,
  signInWithGoogle,
} from '../../auth/firebaseAuth';
import Button from '../Button';
import Modal from '../Modal';
import './AuthDialog.scss';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const POPUP_WATCH_MS = 250;
/** Facebook app setup is not ready. Turn this on after production launch. */
const SHOW_FACEBOOK_SIGN_IN = false;

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

/** `null` means the browser refused to say whether the window is closed. */
function isPopupClosed(popup: Window): boolean | null {
  try {
    return popup.closed;
  } catch (error) {
    console.warn('Could not read the sign-in window:', error);
    return null;
  }
}

/** Firebase keeps the sign-in promise pending for seconds after the window closes. */
function watchSignInPopup(onClose: () => void): () => void {
  let popup: Window | null = null;
  let stopped = false;
  let watch = 0;
  const openWindow = window.open.bind(window);
  const watchOpen: typeof window.open = (...args) => {
    const next = openWindow(...args);
    popup = next;
    window.open = openWindow;
    return next;
  };
  window.open = watchOpen;

  const stop = () => {
    if (stopped) return;
    stopped = true;
    window.clearInterval(watch);
    if (window.open === watchOpen) window.open = openWindow;
  };

  watch = window.setInterval(() => {
    if (!popup) return;
    const closed = isPopupClosed(popup);
    if (closed === null) {
      stop();
      return;
    }
    if (!closed) return;
    stop();
    onClose();
  }, POPUP_WATCH_MS);

  return stop;
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

function authFailureMessage(error: unknown, fallback: string): string {
  const code = firebaseErrorCode(error);
  switch (code) {
    case 'auth/invalid-email':
      return 'Enter a valid email address.';
    case 'auth/missing-password':
    case 'auth/weak-password':
    case 'auth/password-does-not-meet-requirements':
      return firebasePasswordMessage(error) ?? 'That password was rejected. Try another one.';
    case 'auth/email-already-in-use':
      return 'An account with that email already exists. Sign in instead.';
    case 'auth/account-exists-with-different-credential':
      return 'An account already uses that email with a different sign-in method.';
    case 'auth/invalid-credential':
    case 'auth/invalid-login-credentials':
    case 'auth/user-not-found':
    case 'auth/wrong-password':
      return 'That email and password do not match.';
    case 'auth/popup-blocked':
      return 'The browser blocked the sign-in window. Allow popups and try again.';
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
  const displayNameId = useId();
  const passwordId = useId();
  const confirmPasswordId = useId();
  const [mode, setMode] = useState<AuthMode>('sign-in');
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [resetSent, setResetSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const actionId = useRef(0);

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
    // A popup sign-in can still be finishing. Leave its result off this form.
    actionId.current += 1;
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
    setError(authFailureMessage(errorValue, fallback));
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
    if (mode === 'create' && password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    const action = ++actionId.current;
    setBusy(true);
    try {
      if (mode === 'reset') {
        await sendPasswordReset(trimmedEmail);
        setResetSent(true);
        return;
      }
      if (mode === 'create') {
        await createAccount(trimmedEmail, password, displayName.trim());
        return;
      }
      await signInWithEmail(trimmedEmail, password);
    } catch (errorValue) {
      if (mode === 'reset' && isUnknownResetAccount(firebaseErrorCode(errorValue))) {
        console.warn(
          'Password reset found no account. The form still asks the user to check email:',
          errorValue,
        );
        setResetSent(true);
        return;
      }
      const actionName = mode === 'reset'
        ? 'Password reset'
        : mode === 'create'
          ? 'Create account'
          : 'Sign-in';
      const fallback = mode === 'reset'
        ? 'Could not start a password reset. Try again.'
        : mode === 'create'
          ? 'Could not create the account. Try again.'
          : 'Could not sign in. Try again.';
      fail(errorValue, actionName, fallback);
    } finally {
      if (actionId.current === action) setBusy(false);
    }
  };

  const startPopupSignIn = async (
    signIn: () => Promise<void>,
    actionName: string,
    fallback: string,
  ) => {
    if (busy) return;
    const action = ++actionId.current;
    setError(null);
    setResetSent(false);
    setBusy(true);
    // Closing the window only releases the buttons. This attempt stays current
    // until the user starts another one, so a later failure can still be shown.
    const stopWatch = watchSignInPopup(() => {
      if (actionId.current !== action) return;
      setBusy(false);
    });
    try {
      await signIn();
    } catch (errorValue) {
      if (actionId.current !== action) {
        if (isDismissedSignIn(errorValue)) {
          console.warn(`${actionName} was closed before it finished:`, errorValue);
        } else {
          console.error(`${actionName} failed after the form moved on:`, errorValue);
        }
        return;
      }
      fail(errorValue, actionName, fallback);
    } finally {
      stopWatch();
      if (actionId.current === action) setBusy(false);
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
        {mode === 'create' ? (
          <label className="auth-form__field" htmlFor={displayNameId}>
            <span className="auth-form__label">
              Display name
              <span className="auth-form__optional"> (optional)</span>
            </span>
            <input
              id={displayNameId}
              className="auth-form__input"
              type="text"
              autoComplete="nickname"
              value={displayName}
              disabled={busy}
              onChange={(event) => setDisplayName(event.target.value)}
            />
          </label>
        ) : null}
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
        {mode === 'create' ? (
          <label className="auth-form__field" htmlFor={confirmPasswordId}>
            <span className="auth-form__label">Confirm password</span>
            <input
              id={confirmPasswordId}
              className="auth-form__input"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              disabled={busy}
              onChange={(event) => setConfirmPassword(event.target.value)}
            />
          </label>
        ) : null}
        {mode === 'create' ? (
          <p className="auth-form__hint">
            We email you a link to verify this account.
          </p>
        ) : null}
        <Button type="submit" fullWidth disabled={busy}>
          {mode === 'sign-in' ? <MdLogin className="auth-form__icon" aria-hidden="true" /> : null}
          {mode === 'create' ? <MdPersonAdd className="auth-form__icon" aria-hidden="true" /> : null}
          {mode === 'reset' ? <MdLockReset className="auth-form__icon" aria-hidden="true" /> : null}
          {submitLabel}
        </Button>
        {mode === 'reset' ? null : (
          <>
            <Button
              type="button"
              variant="secondary"
              fullWidth
              disabled={busy}
              onClick={() => void startPopupSignIn(
                signInWithGoogle,
                'Google sign-in',
                'Google sign-in failed. Try again.',
              )}
            >
              <FcGoogle className="auth-form__icon" aria-hidden="true" />
              Continue with Google
            </Button>
            {SHOW_FACEBOOK_SIGN_IN ? (
              <Button
                type="button"
                variant="secondary"
                fullWidth
                disabled={busy}
                onClick={() => void startPopupSignIn(
                  signInWithFacebook,
                  'Facebook sign-in',
                  'Facebook sign-in failed. Try again.',
                )}
              >
                <FaFacebook className="auth-form__icon auth-form__icon--facebook" aria-hidden="true" />
                Continue with Facebook
              </Button>
            ) : null}
          </>
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
