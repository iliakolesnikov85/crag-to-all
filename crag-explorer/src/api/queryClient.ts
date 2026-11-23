import { QueryClient } from '@tanstack/react-query';

const queryDefaults = {
  queries: {
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    networkMode: 'always' as const,
  },
  mutations: {
    retry: false,
    networkMode: 'always' as const,
  },
};

function buildQueryClient(): QueryClient {
  return new QueryClient({ defaultOptions: queryDefaults });
}

export const queryKeys = {
  /** Matches every signed-in and signed-out catalog query. */
  cragsAll: ['crags'] as const,
  crags: (uid: string | null) => ['crags', uid] as const,
  /** Matches every viewer's copy of this crag. */
  cragAll: (cragId: string) => ['crag', cragId] as const,
  crag: (cragId: string, uid: string | null = null) => ['crag', cragId, uid] as const,
  cragMembers: (cragId: string) => ['crag-members', cragId] as const,
};

export const queryClient = buildQueryClient();

export function createAppQueryClient(): QueryClient {
  return buildQueryClient();
}
