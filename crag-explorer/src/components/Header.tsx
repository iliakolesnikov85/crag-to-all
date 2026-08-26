import React from 'react';
import { Link } from 'react-router';
import { MdCloudOff } from 'react-icons/md';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import './Header.scss';

interface HeaderProps {
  title: string;
}

const Header: React.FC<HeaderProps> = ({ title }) => {
  const online = useOnlineStatus();

  return (
    <header className="app-header">
      <div className="app-header__offline">
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
      </div>
      <h1 className="app-header__title">{title}</h1>
      <div className="app-header__explore">
        <Link to="/" className="link app-header__explore-crags">
          <span className="app-header__explore-crags-board">Explore other crags</span>
          <span className="app-header__explore-crags-post" aria-hidden="true" />
        </Link>
      </div>
    </header>
  );
};

export default Header;
