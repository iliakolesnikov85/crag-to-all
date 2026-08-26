import { useCallback, useEffect, useState } from 'react';
import { isOfflineDataOutdated } from '../utils/offlineCrag';
import { getAllOfflineManifests } from '../utils/offlineManifestDb';
import { useOnlineStatus } from './useOnlineStatus';

export function useOfflineCrags(): {
  downloadedIds: Set<string>;
  /** Map cragId → needs update (online only, downloaded crags). */
  updateStatusMap: Map<string, boolean>;
} {
  const online = useOnlineStatus();
  const [downloadedIds, setDownloadedIds] = useState<Set<string>>(new Set());
  const [updateStatusMap, setUpdateStatusMap] = useState<Map<string, boolean>>(
    new Map(),
  );

  const refresh = useCallback(() => {
    getAllOfflineManifests().then(async (manifests) => {
      const ids = manifests.map((m) => m.cragId);
      setDownloadedIds(new Set(ids));

      if (!online || ids.length === 0) {
        setUpdateStatusMap(new Map());
        return;
      }

      const entries = await Promise.all(
        ids.map(async (id) => {
          const outdated = await isOfflineDataOutdated(id);
          return [id, outdated] as const;
        }),
      );
      setUpdateStatusMap(new Map(entries));
    });
  }, [online]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    window.addEventListener('offline-crags-changed', refresh);
    return () => window.removeEventListener('offline-crags-changed', refresh);
  }, [refresh]);

  return { downloadedIds, updateStatusMap };
}
