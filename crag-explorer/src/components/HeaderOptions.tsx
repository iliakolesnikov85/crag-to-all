import { useState } from 'react';
import { MdMenu } from 'react-icons/md';
import { useNavigate } from 'react-router';
import { signOutCurrentUser } from '../auth/firebaseAuth';
import { useAuthSession } from '../auth/useAuthSession';
import ProfileDialog from './auth/ProfileDialog';
import OptionsMenu from './OptionsMenu';
import './HeaderOptions.scss';

function HeaderOptions() {
  const account = useAuthSession();
  const navigate = useNavigate();
  const [profileOpen, setProfileOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);

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

  // This component stays mounted after sign-out. Drop the open Profile flag
  // so the next sign-in does not show the dialog on its own.
  if (!account && profileOpen) setProfileOpen(false);
  if (!account) return null;

  return (
    <div className="header-options">
      <OptionsMenu
        label="Menu"
        overlay
        items={[
          { label: 'Profile Settings', onSelect: () => setProfileOpen(true) },
          ...(account.superadmin === true
            ? [{ label: 'Manage Crags', onSelect: () => navigate('/crag-manage') }]
            : []),
          { label: 'Sign out', onSelect: () => void signOut(), separatorBefore: true },
        ]}
        renderButton={({ open, ...buttonProps }) => (
          <button
            type="button"
            className={`header-options__button${open ? ' is-open' : ''}`}
            {...buttonProps}
          >
            <MdMenu aria-hidden="true" />
          </button>
        )}
      />
      {signOutError ? (
        <p className="header-options__error" role="alert">
          {signOutError}
        </p>
      ) : null}
      {profileOpen ? <ProfileDialog onClose={() => setProfileOpen(false)} /> : null}
    </div>
  );
}

export default HeaderOptions;
