import { useCallback, useEffect, useState } from 'react';
import { isOfflineDataOutdated } from '../utils/offlineCrag';
import { useOnlineStatus } from './useOnlineStatus';

export function useOfflineUpdateStatus(cragId: string | undefined): {
  needsUpdate: boolean;
  checking: boolean;
  refresh: () => void;
} {
  const online = useOnlineStatus();
  const [needsUpdate, setNeedsUpdate] = useState(false);
  const [checking, setChecking] = useState(false);

  const refresh = useCallback(() => {
    if (!cragId || !online) {
      setNeedsUpdate(false);
      setChecking(false);
      return;
    }
    setChecking(true);
    isOfflineDataOutdated(cragId)
      .then(setNeedsUpdate)
      .catch(() => setNeedsUpdate(false))
      .finally(() => setChecking(false));
  }, [cragId, online]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const onChanged = () => refresh();
    window.addEventListener('offline-crags-changed', onChanged);
    return () => window.removeEventListener('offline-crags-changed', onChanged);
  }, [refresh]);

  return { needsUpdate, checking, refresh };
}
