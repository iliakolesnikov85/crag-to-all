import { useQuery } from '@tanstack/react-query';
import { useRef } from 'react';
import { useAppOnline } from '../context/AppOnlineContext';
import { getOfflineCragIndex, putOfflineCragIndex } from '../utils/offline';
import { listCrags } from './client';
import { queryKeys } from './queryClient';

export function useCragsQuery() {
  const { markNetworkLimited, markNetworkOk } = useAppOnline();
  const markNetworkLimitedRef = useRef(markNetworkLimited);
  const markNetworkOkRef = useRef(markNetworkOk);
  markNetworkLimitedRef.current = markNetworkLimited;
  markNetworkOkRef.current = markNetworkOk;

  return useQuery({
    queryKey: queryKeys.crags,
    queryFn: async ({ signal }) => {
      try {
        const data = await listCrags({
          cache: navigator.onLine ? 'no-store' : 'default',
          signal,
        });
        if (signal.aborted) {
          throw signal.reason ?? new DOMException('The operation was aborted.', 'AbortError');
        }
        await putOfflineCragIndex(data);
        markNetworkOkRef.current();
        return data;
      } catch (error) {
        if (signal.aborted) throw error;
        console.warn('Failed to fetch crag index, using offline fallback:', error);
        markNetworkLimitedRef.current();
        const cachedIndex = await getOfflineCragIndex();
        if (cachedIndex?.length) return cachedIndex;
        throw error;
      }
    },
  });
}
