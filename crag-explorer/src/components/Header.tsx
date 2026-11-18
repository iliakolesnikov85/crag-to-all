import React from 'react';
import { Link } from 'react-router';
import { MdCloudOff } from 'react-icons/md';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import AuthControls from './auth/AuthControls';
import HeaderOptions from './HeaderOptions';
import './Header.scss';

const assetUrl = (path: string) => `${import.meta.env.BASE_URL}${path}`.replace(/\/{2,}/g, '/');

const Header: React.FC = () => {
  const online = useOnlineStatus();

  return (
    <header className="app-header">
      <Link to="/" className="app-header__brand" aria-label="Crags For All">
        <img
          className="app-header__logo"
          src={assetUrl('icon.svg')}
          alt=""
          width={48}
          height={48}
          decoding="async"
        />
        <span className="app-header__name">Crags For All</span>
      </Link>
      <div className="app-header__actions">
        {!online && (
          <span
            className="app-header__offline-badge"
            role="status"
            title="You're offline — showing downloaded data where available."
            aria-label="You're offline — showing downloaded data where available."
          >
            <span className="app-header__offline-icon" aria-hidden="true">
              <MdCloudOff focusable="false" />
            </span>
            <span className="app-header__offline-label">Offline</span>
          </span>
        )}
        <AuthControls />
        <HeaderOptions />
      </div>
    </header>
  );
};

export default Header;
