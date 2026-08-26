import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

interface AppOnlineContextValue {
  /** False when browser is offline or Firebase/index is unreachable. */
  isOnline: boolean;
  markNetworkLimited: () => void;
  markNetworkOk: () => void;
}

export const AppOnlineContext = createContext<AppOnlineContextValue | null>(null);

export function AppOnlineProvider({ children }: { children: React.ReactNode }) {
  const [navigatorOnline, setNavigatorOnline] = useState(
    () => typeof navigator !== 'undefined' && navigator.onLine,
  );
  const [networkLimited, setNetworkLimited] = useState(false);

  useEffect(() => {
    const sync = () => {
      const nowOnline = navigator.onLine;
      setNavigatorOnline(nowOnline);
      if (nowOnline) {
        setNetworkLimited(false);
      }
    };
    window.addEventListener('online', sync);
    window.addEventListener('offline', sync);
    sync();
    return () => {
      window.removeEventListener('online', sync);
      window.removeEventListener('offline', sync);
    };
  }, []);

  const markNetworkLimited = useCallback(() => setNetworkLimited(true), []);
  const markNetworkOk = useCallback(() => setNetworkLimited(false), []);

  const isOnline = navigatorOnline && !networkLimited;

  const value = useMemo(
    () => ({ isOnline, markNetworkLimited, markNetworkOk }),
    [isOnline, markNetworkLimited, markNetworkOk],
  );

  return (
    <AppOnlineContext.Provider value={value}>{children}</AppOnlineContext.Provider>
  );
}

export function useAppOnline(): AppOnlineContextValue {
  const ctx = useContext(AppOnlineContext);
  if (!ctx) {
    throw new Error('useAppOnline must be used within AppOnlineProvider');
  }
  return ctx;
}
