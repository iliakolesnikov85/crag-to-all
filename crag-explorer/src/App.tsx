import React from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation, useMatch } from 'react-router';
import './App.scss';
import { IndexHttpError } from './api/client';
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
  AboutPage,
  AuthorsPage,
  NotFound,
  Homepage,
  BetaVideos,
  CragManagePage,
} from './pages';
import { SeoDynamic, LoadingScreen, AppShell } from './components';
import { AuthProvider } from './auth/AuthProvider';
import { AppOnlineProvider } from './context/AppOnlineContext';
import { ConfirmProvider } from './context/ConfirmContext';
import {
  CragContext,
  EMPTY_CRAG_CONTEXT,
  useCrag,
  type CragContextType,
} from './context/CragContext';
import { FilterContext, useFilterState } from './context/FilterContext';

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
  return crags.find((crag) => crag.id === segment) ?? null;
}

const AppContent: React.FC = () => {
  const { crag } = useCrag();
  // The page routes sit below this component, so read their params from the URL.
  const pageMatch = useMatch('/:cragId/sector/:sectorName/:routeName?');
  const cragQuery = useCragQuery(crag.id || null);
  const filterContext = useFilterState();

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
        <Route path="/overview" element={<OverviewPage description={cragData.description} sectors={cragData.sectors} />} />
        <Route path="/routes" element={<RoutesPage sectors={cragData.sectors} />} />
        <Route path="/map" element={<MapPage cragData={cragData} />} />
        <Route
          path="/description"
          element={
            <DescriptionPage
              description={cragData.description}
              version={cragData.version}
            />
          }
        />
        <Route path="/download" element={<DownloadPage cragData={cragData} />} />
        <Route path="/authors" element={<AuthorsPage />} />
        <Route path="/sector/:sectorName" element={<SectorPage sectors={cragData.sectors} />} />
        <Route path="/sector/:sectorName/:routeName" element={<RoutePage sectors={cragData.sectors} />} />
        <Route path="/beta-videos/:sectorName/:routeName" element={<BetaVideos sectors={cragData.sectors} />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    );
  }

  return (
    <FilterContext.Provider value={filterContext}>
      <SeoDynamic
        crag={crag}
        cragData={cragQuery.data}
        currentSector={pageMatch?.params.sectorName}
        currentRoute={pageMatch?.params.routeName}
      />
      {main}
    </FilterContext.Provider>
  );
};

const CatalogUnavailable: React.FC<{ error: IndexHttpError | null }> = ({ error }) => (
  <div className="page">
    {error ? (
      <p role="alert">{error.message}</p>
    ) : (
      <p>No crags available. Connect to the internet or download a crag for offline use first.</p>
    )}
  </div>
);

export const AppRoutes: React.FC = () => {
  const { pathname } = useLocation();
  const cragsQuery = useCragsQuery();
  const crags = cragsQuery.data ?? [];
  const crag = cragFromPath(pathname, crags);

  const indexError = cragsQuery.error instanceof IndexHttpError ? cragsQuery.error : null;
  const hasCatalog = !indexError && crags.length > 0;

  const page = cragsQuery.isPending ? (
    <LoadingScreen message="Loading crags list..." />
  ) : (
    <Routes>
      <Route path="/about" element={<AboutPage />} />
      <Route path="/crag-manage" element={<CragManagePage />} />
      {hasCatalog ? (
        <>
          <Route path="/" element={<Homepage crags={crags} />} />
          {/* AppContent shows NotFound when the id is not a crag. */}
          <Route path="/:cragId/*" element={<AppContent />} />
        </>
      ) : (
        <Route path="*" element={<CatalogUnavailable error={indexError} />} />
      )}
    </Routes>
  );

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
