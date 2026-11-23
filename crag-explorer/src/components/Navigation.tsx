import React, { useState } from 'react';
import { Link, useLocation } from 'react-router';
import { useCanEditCrag } from '../auth/useAuthSession';
import { useCrag } from '../context/CragContext';
import './Navigation.scss';

interface NavTab {
  path: string;
  label: string;
}

const Navigation: React.FC = () => {
  const location = useLocation();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const { crag, getUrl } = useCrag();
  const showAuthors = useCanEditCrag(crag);

  const mainTabs: NavTab[] = [
    { path: `/routes`, label: 'Routes' },
    { path: `/map`, label: 'Map' },
    { path: `/download`, label: 'Download' }
  ];

  const authorsTab: NavTab = { path: `/authors`, label: 'Authors' };

  const dropdownTabs: NavTab[] = [
    { path: `/overview`, label: 'Overview' },
    { path: `/description`, label: 'Description' },
    ...(showAuthors ? [authorsTab] : []),
  ];

  const allTabs: NavTab[] = [
    { path: `/overview`, label: 'Overview' },
    { path: `/routes`, label: 'Routes' },
    { path: `/map`, label: 'Map' },
    { path: `/download`, label: 'Download' },
    { path: `/description`, label: 'Description' },
    ...(showAuthors ? [authorsTab] : []),
  ];

  const closeDropdown = () => {
    setIsDropdownOpen(false);
  };

  return (
    <div className="tab-navigation">
      {/* Mobile: Show dropdown and main tabs */}
      <div className="mobile-nav">        
        {mainTabs.map(tab => (
          <Link
            key={tab.path}
            to={getUrl(tab.path)}
            className={`tab-button ${location.pathname === getUrl(tab.path) ? 'active' : ''}`}
            onClick={closeDropdown}
          >
            {tab.label}
          </Link>
        ))}
        <div className="dropdown-container">
          <button
            className={`dropdown-button ${isDropdownOpen ? 'active' : ''}`}
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          >
            ⋯
          </button>
          {isDropdownOpen && (
            <div className="dropdown-menu">
              {dropdownTabs.map(tab => (
                <Link
                  key={tab.path}
                  to={getUrl(tab.path)}
                  className={`dropdown-item ${location.pathname === getUrl(tab.path) ? 'active' : ''}`}
                  onClick={closeDropdown}
                >
                  {tab.label}
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Desktop: Show all tabs */}
      <div className="desktop-nav">
        {allTabs.map(tab => (
          <Link
            key={tab.path}
            to={getUrl(tab.path)}
            className={`tab-button ${location.pathname === getUrl(tab.path) ? 'active' : ''}`}
          >
            {tab.label}
          </Link>
        ))}
      </div>
    </div>
  );
};

export default Navigation; 