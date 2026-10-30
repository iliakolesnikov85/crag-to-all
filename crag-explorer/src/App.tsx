import React, { useCallback, useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router';
import './App.scss';
import { useCragQuery } from './api/useCragQuery';
import { useCragsQuery } from './api/useCragsQuery';
import { Crag } from './types';
import { getDefaultCragForHost } from './utils/defaultCrag';
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
import { AppOnlineProvider } from './context/AppOnlineContext';
import { CragContext } from './context/CragContext';
import { FilterContext, useFilterState } from './context/FilterContext';

const AppContent: React.FC<{ crags: Crag[]; defaultCragId?: string }> = ({ crags, defaultCragId }) => {
  const cragId = crags.find(c => c.cragId === location.pathname.split('/')[1])?.cragId;

  const [currentSector, setCurrentSector] = useState<string | undefined>();
  const [currentRoute, setCurrentRoute] = useState<string | undefined>();

  const effectiveCragId = cragId || defaultCragId || (crags.length > 0 ? crags[0].cragId : null);
  const crag = crags.find(c => c.cragId === effectiveCragId) || null;
  const cragQuery = useCragQuery(effectiveCragId);

  const filterContext = useFilterState();

  const handleSectorChange = useCallback((sectorName: string | undefined) => {
    setCurrentSector(sectorName);
  }, []);

  const handleRouteChange = useCallback((routeName: string | undefined) => {
    setCurrentRoute(routeName);
  }, []);

  if (!crag) return <div className="page">Crag not found.</div>;
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
          url = url.startsWith('/') ? url : `/${url}`;
          if (crag.cragId === defaultCragId) {
            return url;
          }
          return `/${crag.cragId}${url}`;
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

  const defaultCrag = getDefaultCragForHost(crags);

  return (
    <Routes>
      <Route path="/" element={<CragSelector crags={crags} />} />
      {crags.map((crag) => (
        <Route
          key={crag.cragId}
          path={`/${crag.cragId}/*`}
          element={<AppContent crags={crags} defaultCragId={defaultCrag?.cragId} />}
        />
      ))}
      <Route path="/*" element={<AppContent crags={crags} defaultCragId={defaultCrag?.cragId} />} />
    </Routes>
  );
};

const App: React.FC = () => (
  <AppOnlineProvider>
    <Router>
      <AppRoutes />
    </Router>
  </AppOnlineProvider>
);

export default App;
