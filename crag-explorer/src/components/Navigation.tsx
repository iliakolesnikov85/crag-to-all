import React, { useState } from 'react';
import { Link, useLocation } from 'react-router';
import { useCrag } from '../context/CragContext';
import './Navigation.scss';

const Navigation: React.FC = () => {
  const location = useLocation();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const { getUrl } = useCrag();
  
  const mainTabs = [
    { path: `/routes`, label: 'Routes' },
    { path: `/map`, label: 'Map' },
    { path: `/download`, label: 'Download' }
  ];

  const dropdownTabs = [
    { path: `/overview`, label: 'Overview' },
    { path: `/description`, label: 'Description' },
    { path: `/team`, label: 'Team' }
  ];

  const allTabs = [
    { path: `/overview`, label: 'Overview' },
    { path: `/routes`, label: 'Routes' },
    { path: `/map`, label: 'Map' },
    { path: `/download`, label: 'Download' },
    { path: `/description`, label: 'Description' },
    { path: `/team`, label: 'Team' }
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