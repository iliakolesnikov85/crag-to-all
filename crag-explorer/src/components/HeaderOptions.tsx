import { MdMenu } from 'react-icons/md';
import { useNavigate } from 'react-router';
import { useAuthSession } from '../auth/useAuthSession';
import OptionsMenu from './OptionsMenu';
import './HeaderOptions.scss';

function HeaderOptions() {
  const account = useAuthSession();
  const navigate = useNavigate();

  if (account?.superadmin !== true) return null;

  return (
    <OptionsMenu
      label="Menu"
      overlay
      className="header-options"
      items={[
        { label: 'Manage Crags', onSelect: () => navigate('/crag-manage') },
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
  );
}

export default HeaderOptions;
