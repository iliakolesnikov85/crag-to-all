import { useState } from 'react';
import { isAuthEnabled } from '../../auth/config';
import { signOutCurrentUser } from '../../auth/firebaseAuth';
import { useAuthSession } from '../../auth/useAuthSession';
import Button from '../Button';
import AuthDialog from './AuthDialog';
import './AuthControls.scss';

function AuthControls() {
  const account = useAuthSession();
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);

  // Sign-in hides this dialog without clearing `open`. Clear it while signed in
  // so Sign out does not show the dialog again.
  if (account && open) setOpen(false);

  if (!isAuthEnabled()) return null;

  const signOut = async () => {
    if (signingOut) return;
    setSignOutError(null);
    setSigningOut(true);
    try {
      await signOutCurrentUser();
    } catch (error) {
      console.error('Sign-out failed:', error);
      setSignOutError('Could not sign out. Try again.');
    } finally {
      setSigningOut(false);
    }
  };

  if (account) {
    const email = account.email ?? 'Signed in';
    return (
      <div className="auth-controls">
        <p className="auth-controls__row">
          <span className="auth-controls__user" title={email}>
            {email}
          </span>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={signingOut}
            onClick={() => void signOut()}
          >
            Sign out
          </Button>
        </p>
        {signOutError ? (
          <p className="auth-controls__error" role="alert">
            {signOutError}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="auth-controls">
      <Button type="button" size="sm" variant="secondary" onClick={() => setOpen(true)}>
        Sign in
      </Button>
      {open ? <AuthDialog onClose={() => setOpen(false)} /> : null}
    </div>
  );
}

export default AuthControls;
