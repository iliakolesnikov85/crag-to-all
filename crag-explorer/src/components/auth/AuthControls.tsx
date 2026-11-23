import { useState } from 'react';
import { isAuthEnabled } from '../../auth/config';
import { useAuthSession } from '../../auth/useAuthSession';
import Button from '../Button';
import AuthDialog from './AuthDialog';
import './AuthControls.scss';

function AuthControls() {
  const account = useAuthSession();
  const [open, setOpen] = useState(false);

  // Sign-in hides this dialog without clearing `open`. Clear it while signed in
  // so signing out does not show the dialog again.
  if (account && open) setOpen(false);

  if (!isAuthEnabled()) return null;

  if (account) {
    const email = account.email ?? 'Signed in';
    return (
      <div className="auth-controls">
        <p className="auth-controls__row">
          <span className="auth-controls__user" title={email}>
            {email}
          </span>
        </p>
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
