import { useEffect, useId, useState, type FormEvent } from 'react';
import { useMutation } from '@tanstack/react-query';
import {
  refreshEmailVerified,
  sendPasswordReset,
  sendVerificationEmail,
  updateDisplayName,
} from '../../auth/firebaseAuth';
import { useAuthSession } from '../../auth/useAuthSession';
import Button from '../Button';
import Modal from '../Modal';
import './ProfileDialog.scss';

function actionError(error: unknown, fallback: string): string {
  const code = error && typeof error === 'object' && 'code' in error
    ? (error as { code: unknown }).code
    : '';
  if (code === 'auth/too-many-requests') {
    return 'Too many emails were sent. Wait a few minutes and try again.';
  }
  if (code === 'auth/requires-recent-login') {
    return 'Sign in again, then try once more.';
  }
  if (code === 'auth/network-request-failed') {
    return 'A network error occurred. Check your connection and try again.';
  }
  return fallback;
}

interface ProfileDialogProps {
  onClose: () => void;
}

function ProfileDialog({ onClose }: ProfileDialogProps) {
  const account = useAuthSession();
  const nameId = useId();
  const [name, setName] = useState(account?.displayName ?? '');
  const saveName = useMutation({
    mutationFn: (nextName: string) => updateDisplayName(nextName),
    onError: (error) => {
      console.error('Failed to save the profile name:', error);
    },
  });
  const sendVerification = useMutation({
    mutationFn: () => sendVerificationEmail(),
    onError: (error) => {
      console.error('Failed to send the verification email:', error);
    },
  });
  const sendReset = useMutation({
    mutationFn: (address: string) => sendPasswordReset(address),
    onError: (error) => {
      console.error('Failed to send the password reset:', error);
    },
  });

  const busy = saveName.isPending || sendVerification.isPending || sendReset.isPending;
  const email = account?.email?.trim() ?? '';
  const verified = account?.emailVerified === true;
  const savedName = account?.displayName ?? '';
  const nameUnchanged = name.trim() === savedName;

  useEffect(() => {
    if (!email || verified) return undefined;
    const refresh = () => {
      void refreshEmailVerified();
    };
    window.addEventListener('focus', refresh);
    void refreshEmailVerified();
    return () => {
      window.removeEventListener('focus', refresh);
    };
  }, [email, verified]);

  const close = () => {
    if (busy) return;
    onClose();
  };

  const submitName = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy || nameUnchanged) return;
    saveName.mutate(name);
  };

  const requestVerification = () => {
    if (busy || !email || verified) return;
    sendVerification.mutate();
  };

  const requestReset = () => {
    if (busy || !email) return;
    sendReset.mutate(email);
  };

  return (
    <Modal
      open
      compact
      title="Profile"
      closeOnBackdrop={!busy}
      onClose={close}
    >
      <form className="profile-dialog" onSubmit={submitName}>
        <p className="profile-dialog__email">
          <span className="profile-dialog__label">Email</span>
          <span>{email || 'No email on this account.'}</span>
        </p>
        <label className="profile-dialog__field" htmlFor={nameId}>
          <span className="profile-dialog__label">Name</span>
          <span className="profile-dialog__name-row">
            <input
              id={nameId}
              className="profile-dialog__input"
              type="text"
              autoComplete="nickname"
              value={name}
              disabled={busy}
              onChange={(event) => {
                setName(event.target.value);
                saveName.reset();
              }}
            />
            <Button type="submit" disabled={busy || nameUnchanged}>
              {saveName.isPending ? 'Saving...' : 'Save name'}
            </Button>
          </span>
        </label>
        {saveName.isSuccess ? (
          <p className="profile-dialog__notice" role="status">
            Name saved.
          </p>
        ) : null}
        {saveName.isError ? (
          <p className="profile-dialog__error" role="alert">
            {actionError(saveName.error, 'Could not save the name. Try again.')}
          </p>
        ) : null}
        <div className="profile-dialog__action">
          {verified ? (
            <p className="profile-dialog__notice" role="status">
              This email is verified.
            </p>
          ) : (
            <>
              <p
                className={sendVerification.isSuccess ? 'profile-dialog__notice' : 'profile-dialog__hint'}
                role="status"
              >
                {sendVerification.isSuccess
                  ? 'Verification email sent. Check your inbox and spam folder.'
                  : 'This email is not verified yet.'}
              </p>
              <Button
                type="button"
                variant="secondary"
                fullWidth
                disabled={busy || !email}
                onClick={requestVerification}
              >
                {sendVerification.isPending ? 'Sending...' : 'Send verification email'}
              </Button>
            </>
          )}
          {sendVerification.isError ? (
            <p className="profile-dialog__error" role="alert">
              {actionError(sendVerification.error, 'Could not send the verification email. Try again.')}
            </p>
          ) : null}
        </div>
        <div className="profile-dialog__action">
          <Button
            type="button"
            variant="secondary"
            fullWidth
            disabled={busy || !email}
            onClick={requestReset}
          >
            {sendReset.isPending ? 'Sending...' : 'Reset password'}
          </Button>
          {sendReset.isSuccess ? (
            <p className="profile-dialog__notice" role="status">
              Check your email for a link to reset your password.
            </p>
          ) : null}
          {sendReset.isError ? (
            <p className="profile-dialog__error" role="alert">
              {actionError(sendReset.error, 'Could not send the password reset. Try again.')}
            </p>
          ) : null}
        </div>
      </form>
    </Modal>
  );
}

export default ProfileDialog;
