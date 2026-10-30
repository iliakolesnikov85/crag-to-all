import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import type { CragData } from '../types';
import { isCragOffline, loadCragDataJson } from '../utils/offline';
import { queryKeys } from './queryClient';

const OFFLINE_CRAG_MESSAGE =
  'You are offline. Download this crag from the Download tab while you have internet.';

async function queryCragData(cragId: string, online: boolean): Promise<CragData> {
  try {
    return await loadCragDataJson(cragId);
  } catch (error) {
    const hasOfflinePack = await isCragOffline(cragId);
    if (hasOfflinePack && !online) {
      console.warn(
        `Crag "${cragId}" failed to load while offline:`,
        error,
      );
      throw new Error(OFFLINE_CRAG_MESSAGE);
    }
    if (error instanceof Error) throw error;
    throw new Error('Failed to load crag data');
  }
}

export function useCragQuery(cragId: string | null) {
  const online = useOnlineStatus();
  const onlineRef = useRef(online);
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: queryKeys.crag(cragId ?? ''),
    enabled: Boolean(cragId),
    queryFn: () => {
      if (!cragId) throw new Error('Failed to load crag data');
      return queryCragData(cragId, onlineRef.current);
    },
  });

  useEffect(() => {
    if (onlineRef.current === online) return;
    onlineRef.current = online;
    if (!cragId) return;
    void queryClient.invalidateQueries({ queryKey: queryKeys.crag(cragId) });
  }, [online, cragId, queryClient]);

  return query;
}
