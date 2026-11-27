import { useQuery } from '@tanstack/react-query';
import { useRef } from 'react';
import { useAuthReady, useAuthSession } from '../auth/useAuthSession';
import { useAppOnline } from '../context/AppOnlineContext';
import { getOfflineCragIndex, putOfflineCragIndex } from '../utils/offline';
import { IndexHttpError, listCrags } from './client';
import { queryKeys } from './queryClient';

export function useCragsQuery() {
  const authReady = useAuthReady();
  const account = useAuthSession();
  const uid = account?.uid ?? null;
  const { markNetworkLimited, markNetworkOk } = useAppOnline();
  const markNetworkLimitedRef = useRef(markNetworkLimited);
  const markNetworkOkRef = useRef(markNetworkOk);
  markNetworkLimitedRef.current = markNetworkLimited;
  markNetworkOkRef.current = markNetworkOk;

  return useQuery({
    queryKey: queryKeys.crags(uid),
    // Unpublished crags are hidden until we know who is signed in.
    // Loading earlier builds routes from the public list and flashes a 404.
    enabled: authReady,
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
        // A status means the server answered. Offline mode is only for no response.
        if (error instanceof IndexHttpError) {
          console.error('Failed to fetch crag index:', error);
          throw error;
        }
        console.warn('Failed to fetch crag index, using offline fallback:', error);
        markNetworkLimitedRef.current();
        const cachedIndex = await getOfflineCragIndex();
        if (cachedIndex?.length) return cachedIndex;
        throw error;
      }
    },
  });
}
