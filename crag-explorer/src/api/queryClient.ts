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
  crags: ['crags'] as const,
  crag: (cragId: string) => ['crag', cragId] as const,
};

export const queryClient = buildQueryClient();

export function createAppQueryClient(): QueryClient {
  return buildQueryClient();
}
