import React from 'react';
import { useCrag } from '../context/CragContext';
import Footer from './Footer';
import Header from './Header';
import Navigation from './Navigation';
import UnpublishedBadge from './UnpublishedBadge';

interface AppShellProps {
  children: React.ReactNode;
}

const AppShell: React.FC<AppShellProps> = ({ children }) => {
  const { crag } = useCrag();

  return (
    <div className="App">
      <div className="app-container">
        <Header />
        {crag.id ? (
          <h1 className="app-crag-name">
            <span className="app-crag-name__text">{crag.cragName}</span>
            {crag.published === false ? (
              <>
                {' '}
                <UnpublishedBadge variant="header" />
              </>
            ) : null}
          </h1>
        ) : null}
        {crag.id ? <Navigation /> : null}
        <main className="app-main">{children}</main>
        <Footer />
      </div>
    </div>
  );
};

export default AppShell;
