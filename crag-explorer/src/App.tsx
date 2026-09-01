import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router';
import './App.scss';
import { CragData, Crag } from './types';
import { getCragIndexUrl } from './utils/firebaseStorage';
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
import { AppOnlineProvider, useAppOnline } from './context/AppOnlineContext';
import { CragContext } from './context/CragContext';
import { FilterContext, useFilterState } from './context/FilterContext';
import { useOnlineStatus } from './hooks/useOnlineStatus';
import { isCragOffline, loadCragDataJson } from './utils/offlineCrag';
import {
  getOfflineCragIndex,
  putOfflineCragIndex,
} from './utils/offlineManifestDb';
const AppContent: React.FC<{ crags: Crag[]; defaultCragId?: string }> = ({ crags, defaultCragId }) => {
  const online = useOnlineStatus();
  const cragId = crags.find(c => c.cragId === location.pathname.split('/')[1])?.cragId;

  const [cragData, setCragData] = useState<CragData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentSector, setCurrentSector] = useState<string | undefined>();
  const [currentRoute, setCurrentRoute] = useState<string | undefined>();
  
  const effectiveCragId = cragId || defaultCragId || (crags.length > 0 ? crags[0].cragId : null);
  const crag = crags.find(c => c.cragId === effectiveCragId) || null;

  const filterContext = useFilterState();

  useEffect(() => {
    if (!effectiveCragId) return;
    setLoading(true);
    setError(null);

    loadCragDataJson(effectiveCragId)
      .then((data) => {
        setCragData(data);
        setLoading(false);
      })
      .catch(async (err) => {
        const hasOfflinePack = await isCragOffline(effectiveCragId);
        if (hasOfflinePack && !online) {
          setError('You are offline. Download this crag from the Download tab while you have internet.');
        } else {
          setError(err instanceof Error ? err.message : 'Failed to load crag data');
        }
        setLoading(false);
      });
  }, [effectiveCragId, online]);

  const handleSectorChange = React.useCallback((sectorName: string | undefined) => {
    setCurrentSector(sectorName);
  }, []);

  const handleRouteChange = React.useCallback((routeName: string | undefined) => {
    setCurrentRoute(routeName);
  }, []);

  if (!crag) return <div className="page">Crag not found.</div>;
  if (loading) return <LoadingScreen message="Loading crag data..." />;
  if (error) return <div className="page">Error: {error}</div>;
  if (!cragData) return <div className="page">No data for this crag.</div>;

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
                <Route path={`/description`} element={<DescriptionPage description={cragData.description} />} />
                <Route
                  path={`/download`}
                  element={<DownloadPage cragData={cragData} />}
                />
                <Route path={`/team`} element={<TeamPage />} />
                <Route path={`/sector/:sectorName`} element={<SectorPage sectors={cragData.sectors} onSectorChange={handleSectorChange} />} />
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

const AppRoutes: React.FC = () => {
  const { markNetworkLimited, markNetworkOk } = useAppOnline();
  const [crags, setCrags] = useState<Crag[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;

    const loadIndex = async () => {
      try {
        const res = await fetch(getCragIndexUrl(), {
          cache: navigator.onLine ? 'no-store' : 'default',
          signal,
        });
        if (!res.ok) throw new Error('index fetch failed');
        const data: Crag[] = await res.json();
        if (signal.aborted) return;
        await putOfflineCragIndex(data);
        setCrags(data);
        markNetworkOk();
      } catch (error) {
        console.warn('Failed to fetch crag index, using offline fallback:', error);
        if (signal.aborted) return;
        markNetworkLimited();
        const cachedIndex = await getOfflineCragIndex();
        if (!signal.aborted && cachedIndex?.length) {
          setCrags(cachedIndex);
        }
      } finally {
        if (!signal.aborted) setLoading(false);
      }
    };

    loadIndex();
    return () => controller.abort();
  }, [markNetworkLimited, markNetworkOk]);

  if (loading) return <LoadingScreen message="Loading crags list..." />;

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
