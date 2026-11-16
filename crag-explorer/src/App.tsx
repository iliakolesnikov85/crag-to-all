import React, { useCallback, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router';
import './App.scss';
import { useCragQuery } from './api/useCragQuery';
import { useCragsQuery } from './api/useCragsQuery';
import { Crag } from './types';
import {
  OverviewPage,
  RoutesPage,
  MapPage,
  DescriptionPage,
  SectorPage,
  RoutePage,
  DownloadPage,
  TeamPage,
  NotFound,
  CragSelector,
  BetaVideos,
} from './pages';
import { SeoDynamic, Footer, LoadingScreen, Header } from './components';
import Navigation from './components/Navigation';
import { AuthProvider } from './auth/AuthProvider';
import { AppOnlineProvider } from './context/AppOnlineContext';
import { ConfirmProvider } from './context/ConfirmContext';
import { CragContext } from './context/CragContext';
import { FilterContext, useFilterState } from './context/FilterContext';

const AppContent: React.FC<{ crags: Crag[] }> = ({ crags }) => {
  const { pathname } = useLocation();
  const cragId = crags.find(c => c.id === pathname.split('/')[1])?.id ?? null;

  const [currentSector, setCurrentSector] = useState<string | undefined>();
  const [currentRoute, setCurrentRoute] = useState<string | undefined>();

  const crag = crags.find(c => c.id === cragId) || null;
  const cragQuery = useCragQuery(cragId);

  const filterContext = useFilterState();

  const handleSectorChange = useCallback((sectorName: string | undefined) => {
    setCurrentSector(sectorName);
  }, []);

  const handleRouteChange = useCallback((routeName: string | undefined) => {
    setCurrentRoute(routeName);
  }, []);

  if (!crag) return <NotFound />;
  if (cragQuery.isPending) return <LoadingScreen message="Loading crag data..." />;
  if (cragQuery.isError) {
    const message = cragQuery.error instanceof Error
      ? cragQuery.error.message
      : 'Failed to load crag data';
    return <div className="page">Error: {message}</div>;
  }
  if (!cragQuery.data) return <div className="page">No data for this crag.</div>;

  const cragData = cragQuery.data;

  return (
    <CragContext.Provider value={
      {
        crag: crag,
        getUrl: (url: string) => {
          const path = url.startsWith('/') ? url : `/${url}`;
          return `/${crag.id}${path}`;
        }
      }}>
      <FilterContext.Provider value={filterContext}>
        <SeoDynamic cragData={cragData} currentSector={currentSector} currentRoute={currentRoute} />
        <div className="App">
          <div className="app-container">
            <Header title={cragData.name} />
            <Navigation />
            <main className="app-main">
              <Routes>
                <Route path={`/overview`} element={<OverviewPage description={cragData.description} sectors={cragData.sectors} />} />
                <Route path={`/routes`} element={<RoutesPage sectors={cragData.sectors} />} />
                <Route path={`/map`} element={<MapPage cragData={cragData} />} />
                <Route
                  path={`/description`}
                  element={
                    <DescriptionPage
                      description={cragData.description}
                      version={cragData.version}
                    />
                  }
                />
                <Route
                  path={`/download`}
                  element={<DownloadPage cragData={cragData} />}
                />
                <Route path={`/team`} element={<TeamPage />} />
                <Route
                  path={`/sector/:sectorName`}
                  element={
                    <SectorPage
                      sectors={cragData.sectors}
                      onSectorChange={handleSectorChange}
                    />
                  }
                />
                <Route path={`/sector/:sectorName/:routeName`} element={<RoutePage sectors={cragData.sectors} onSectorChange={handleSectorChange} onRouteChange={handleRouteChange} />} />
                <Route path={`/beta-videos/:sectorName/:routeName`} element={<BetaVideos sectors={cragData.sectors} />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </main>
            <Footer />
          </div>
        </div>
      </FilterContext.Provider>
    </CragContext.Provider>
  );
};

export const AppRoutes: React.FC = () => {
  const cragsQuery = useCragsQuery();

  if (cragsQuery.isPending) return <LoadingScreen message="Loading crags list..." />;

  const crags = cragsQuery.data ?? [];

  if (crags.length === 0) {
    return (
      <div className="page">
        <p>No crags available. Connect to the internet or download a crag for offline use first.</p>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/" element={<CragSelector crags={crags} />} />
      {crags.map((crag) => (
        <Route
          key={crag.id}
          path={`/${crag.id}/*`}
          element={<AppContent crags={crags} />}
        />
      ))}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

const App: React.FC = () => (
  <AppOnlineProvider>
    <AuthProvider>
      <ConfirmProvider>
        <Router>
          <AppRoutes />
        </Router>
      </ConfirmProvider>
    </AuthProvider>
  </AppOnlineProvider>
);

export default App;
