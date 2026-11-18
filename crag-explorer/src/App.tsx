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
  Homepage,
  BetaVideos,
  CragManagePage,
} from './pages';
import { SeoDynamic, LoadingScreen, AppShell } from './components';
import { AuthProvider } from './auth/AuthProvider';
import { AppOnlineProvider } from './context/AppOnlineContext';
import { ConfirmProvider } from './context/ConfirmContext';
import { CragContext, useCrag, type CragContextType } from './context/CragContext';
import { FilterContext, useFilterState } from './context/FilterContext';

const EMPTY_CRAG_CONTEXT: CragContextType = {
  crag: { id: '', cragName: '' },
  getUrl: () => {
    throw new Error('getUrl not implemented');
  },
};

function cragContextValue(crag: Crag): CragContextType {
  return {
    crag,
    getUrl: (url: string) => {
      const path = url.startsWith('/') ? url : `/${url}`;
      return `/${crag.id}${path}`;
    },
  };
}

function cragFromPath(pathname: string, crags: Crag[]): Crag | null {
  const segment = pathname.split('/')[1];
  if (!segment || segment === 'crag-manage') return null;
  return crags.find((crag) => crag.id === segment) ?? null;
}

const AppContent: React.FC = () => {
  const { crag } = useCrag();
  const [currentSector, setCurrentSector] = useState<string | undefined>();
  const [currentRoute, setCurrentRoute] = useState<string | undefined>();
  const cragQuery = useCragQuery(crag.id || null);
  const filterContext = useFilterState();

  const handleSectorChange = useCallback((sectorName: string | undefined) => {
    setCurrentSector(sectorName);
  }, []);

  const handleRouteChange = useCallback((routeName: string | undefined) => {
    setCurrentRoute(routeName);
  }, []);

  if (!crag.id) return <NotFound />;

  let main: React.ReactNode;
  if (cragQuery.isPending) {
    main = <LoadingScreen message="Loading crag data..." />;
  } else if (cragQuery.isError) {
    const message = cragQuery.error instanceof Error
      ? cragQuery.error.message
      : 'Failed to load crag data';
    main = <div className="page">Error: {message}</div>;
  } else if (!cragQuery.data) {
    main = <div className="page">No data for this crag.</div>;
  } else {
    const cragData = cragQuery.data;
    main = (
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
    );
  }

  return (
    <FilterContext.Provider value={filterContext}>
      {cragQuery.data ? (
        <SeoDynamic
          cragData={cragQuery.data}
          currentSector={currentSector}
          currentRoute={currentRoute}
        />
      ) : null}
      {main}
    </FilterContext.Provider>
  );
};

export const AppRoutes: React.FC = () => {
  const { pathname } = useLocation();
  const cragsQuery = useCragsQuery();
  const crags = cragsQuery.data ?? [];
  const crag = cragFromPath(pathname, crags);

  let page: React.ReactNode;
  if (cragsQuery.isPending) {
    page = <LoadingScreen message="Loading crags list..." />;
  } else if (crags.length === 0) {
    page = (
      <Routes>
        <Route path="/crag-manage" element={<CragManagePage />} />
        <Route
          path="*"
          element={(
            <div className="page">
              <p>No crags available. Connect to the internet or download a crag for offline use first.</p>
            </div>
          )}
        />
      </Routes>
    );
  } else {
    page = (
      <Routes>
        <Route path="/crag-manage" element={<CragManagePage />} />
        <Route path="/" element={<Homepage crags={crags} />} />
        {crags.map((item) => (
          <Route
            key={item.id}
            path={`/${item.id}/*`}
            element={<AppContent />}
          />
        ))}
        <Route path="*" element={<NotFound />} />
      </Routes>
    );
  }

  return (
    <CragContext.Provider value={crag ? cragContextValue(crag) : EMPTY_CRAG_CONTEXT}>
      <AppShell>{page}</AppShell>
    </CragContext.Provider>
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
